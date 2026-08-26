"""Private upload lifecycle with tenant-scoped object keys."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.db import transaction

from apps.media_assets.models import MediaAsset
from apps.media_assets.storage import PresignedUpload, get_object_storage
from apps.organisations.selectors import TenantContext
from tenda.errors import DomainError

_PURPOSE_RULES: dict[str, tuple[set[str], int]] = {
    MediaAsset.Purpose.PRODUCT_IMAGE: (
        {"image/jpeg", "image/png", "image/webp"},
        10 * 1024 * 1024,
    ),
    MediaAsset.Purpose.PAYMENT_RECEIPT: (
        {"image/jpeg", "image/png", "image/webp", "application/pdf"},
        15 * 1024 * 1024,
    ),
    MediaAsset.Purpose.SHIPPING_EVIDENCE: (
        {"image/jpeg", "image/png", "image/webp", "application/pdf"},
        15 * 1024 * 1024,
    ),
    MediaAsset.Purpose.IMPORT_FILE: (
        {
            "text/csv",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        25 * 1024 * 1024,
    ),
}


@dataclass(frozen=True, slots=True)
class PreparedUpload:
    asset: MediaAsset
    upload: PresignedUpload


def _validate_upload(*, purpose: str, content_type: str, size: int) -> None:
    rule = _PURPOSE_RULES.get(purpose)
    if rule is None:
        raise DomainError("INVALID_UPLOAD_PURPOSE", "El tipo de archivo no es válido.")
    allowed_content_types, max_size = rule
    field_errors: dict[str, list[str]] = {}
    if content_type not in allowed_content_types:
        field_errors["contentType"] = ["El formato del archivo no está permitido."]
    if size <= 0 or size > max_size:
        field_errors["size"] = [f"El archivo debe pesar menos de {max_size // (1024 * 1024)} MB."]
    if field_errors:
        raise DomainError(
            "INVALID_UPLOAD",
            "El archivo no cumple los requisitos.",
            field_errors=field_errors,
        )


@transaction.atomic
def prepare_upload(
    *,
    context: TenantContext,
    purpose: str,
    original_name: str,
    content_type: str,
    size: int,
) -> PreparedUpload:
    _validate_upload(purpose=purpose, content_type=content_type, size=size)
    public_id = uuid.uuid4()
    extension = Path(original_name).suffix.lower()[:12]
    object_key = f"organisations/{context.organisation.public_id}/{purpose}/{public_id}{extension}"
    asset = MediaAsset.objects.create(
        public_id=public_id,
        organisation=context.organisation,
        created_by=context.user,
        purpose=purpose,
        object_key=object_key,
        original_name=Path(original_name).name[:255],
        content_type=content_type,
        expected_size=size,
    )
    upload = get_object_storage().presign_upload(
        key=object_key,
        content_type=content_type,
        size=size,
        expires_in_seconds=900,
    )
    return PreparedUpload(asset=asset, upload=upload)


@transaction.atomic
def complete_upload(*, context: TenantContext, public_id: uuid.UUID) -> MediaAsset:
    asset = (
        MediaAsset.objects.select_for_update()
        .filter(
            public_id=public_id,
            organisation=context.organisation,
            created_by=context.user,
        )
        .first()
    )
    if asset is None:
        raise DomainError("NOT_FOUND", "No encontramos el recurso solicitado.", status=404)
    if asset.status == MediaAsset.Status.READY:
        return asset
    stored = get_object_storage().head(key=asset.object_key)
    if stored.size != asset.expected_size or stored.content_type != asset.content_type:
        asset.status = MediaAsset.Status.REJECTED
        asset.actual_size = stored.size
        asset.save(update_fields=("status", "actual_size", "updated_at"))
        get_object_storage().delete(key=asset.object_key)
        raise DomainError(
            "UPLOAD_MISMATCH",
            "El archivo recibido no coincide con la carga solicitada.",
        )
    asset.actual_size = stored.size
    asset.checksum_sha256 = stored.checksum_sha256
    asset.status = MediaAsset.Status.READY
    asset.save(
        update_fields=(
            "actual_size",
            "checksum_sha256",
            "status",
            "updated_at",
        )
    )
    return asset


@transaction.atomic
def accept_fake_upload(
    *,
    context: TenantContext,
    public_id: uuid.UUID,
    content: bytes,
    content_type: str,
) -> MediaAsset:
    """Receive bytes only in the deterministic local storage adapter.

    Production still uploads directly to R2. This endpoint makes Local/Dev
    exercise the exact same prepare → PUT → complete lifecycle without exposing
    a second upload mechanism in production.
    """

    if str(getattr(settings, "OBJECT_STORAGE_PROVIDER", "fake")) != "fake":
        raise DomainError("NOT_FOUND", "No encontramos el recurso solicitado.", status=404)
    asset = (
        MediaAsset.objects.select_for_update()
        .filter(
            public_id=public_id,
            organisation=context.organisation,
            created_by=context.user,
            status=MediaAsset.Status.PENDING,
        )
        .first()
    )
    if asset is None:
        raise DomainError("NOT_FOUND", "No encontramos el recurso solicitado.", status=404)
    if content_type != asset.content_type or len(content) != asset.expected_size:
        raise DomainError(
            "UPLOAD_MISMATCH",
            "El archivo recibido no coincide con la carga solicitada.",
        )
    get_object_storage().write_bytes(
        key=asset.object_key,
        content=content,
        content_type=content_type,
    )
    asset.status = MediaAsset.Status.UPLOADED
    asset.save(update_fields=("status", "updated_at"))
    return asset


@transaction.atomic
def create_generated_asset(
    *,
    context: TenantContext,
    purpose: str,
    original_name: str,
    content_type: str,
    content: bytes,
) -> MediaAsset:
    """Persist server-generated reports/exports in the same private store."""

    if purpose not in {
        MediaAsset.Purpose.IMPORT_REPORT,
        MediaAsset.Purpose.INVENTORY_EXPORT,
        MediaAsset.Purpose.SHIPPING_LABEL,
    }:
        raise DomainError("INVALID_UPLOAD_PURPOSE", "El tipo de archivo no es válido.")
    public_id = uuid.uuid4()
    extension = Path(original_name).suffix.lower()[:12]
    object_key = f"organisations/{context.organisation.public_id}/{purpose}/{public_id}{extension}"
    stored = get_object_storage().write_bytes(
        key=object_key,
        content=content,
        content_type=content_type,
    )
    return MediaAsset.objects.create(
        public_id=public_id,
        organisation=context.organisation,
        created_by=context.user,
        purpose=purpose,
        object_key=object_key,
        original_name=Path(original_name).name[:255],
        content_type=content_type,
        expected_size=stored.size,
        actual_size=stored.size,
        checksum_sha256=stored.checksum_sha256,
        status=MediaAsset.Status.READY,
    )


def private_download_url(
    *,
    context: TenantContext,
    public_id: uuid.UUID,
) -> str:
    asset = MediaAsset.objects.filter(
        public_id=public_id,
        organisation=context.organisation,
        status=MediaAsset.Status.READY,
    ).first()
    if asset is None:
        raise DomainError("NOT_FOUND", "No encontramos el recurso solicitado.", status=404)
    return get_object_storage().presign_download(
        key=asset.object_key,
        expires_in_seconds=300,
    )
