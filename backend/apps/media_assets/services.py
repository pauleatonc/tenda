"""Private upload lifecycle with tenant-scoped object keys."""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from pathlib import Path

from django.conf import settings
from django.db import transaction

from apps.media_assets.images import (
    is_display_image_purpose,
    render_image_variants,
    variant_content_type,
)
from apps.media_assets.keys import build_object_key, build_variant_key
from apps.media_assets.models import MediaAsset
from apps.media_assets.storage import PresignedUpload, get_object_storage, uses_in_process_upload
from apps.organisations.selectors import TenantContext
from apps.users.models import User
from tenda.errors import DomainError

_PURPOSE_RULES: dict[str, tuple[set[str], int]] = {
    MediaAsset.Purpose.PRODUCT_IMAGE: (
        {"image/jpeg", "image/png", "image/webp"},
        10 * 1024 * 1024,
    ),
    MediaAsset.Purpose.PROFILE_PHOTO: (
        {"image/jpeg", "image/png", "image/webp"},
        10 * 1024 * 1024,
    ),
    MediaAsset.Purpose.ORGANISATION_LOGO: (
        {"image/jpeg", "image/png", "image/webp"},
        10 * 1024 * 1024,
    ),
    MediaAsset.Purpose.PAYMENT_RECEIPT: (
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

MAX_PURPOSE_UPLOAD_BYTES = max(size for _types, size in _PURPOSE_RULES.values())


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
    object_key = build_object_key(
        organisation_id=context.organisation.public_id,
        purpose=purpose,
        public_id=public_id,
        original_name=original_name,
    )
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


def complete_upload(*, context: TenantContext, public_id: uuid.UUID) -> MediaAsset:
    failure: DomainError | None = None
    with transaction.atomic():
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
            failure = DomainError("NOT_FOUND", "No encontramos el recurso solicitado.", status=404)
        elif asset.status == MediaAsset.Status.READY:
            return asset
        else:
            original_key = asset.object_key
            stored = get_object_storage().head(key=original_key)
            try:
                if stored.size != asset.expected_size or stored.content_type != asset.content_type:
                    raise DomainError(
                        "UPLOAD_MISMATCH",
                        "El archivo recibido no coincide con la carga solicitada.",
                    )
                if is_display_image_purpose(asset.purpose):
                    _replace_original_with_variants(asset)
                else:
                    asset.actual_size = stored.size
                    asset.checksum_sha256 = stored.checksum_sha256
                asset.status = MediaAsset.Status.READY
                asset.save(
                    update_fields=(
                        "object_key",
                        "content_type",
                        "actual_size",
                        "checksum_sha256",
                        "variants",
                        "status",
                        "updated_at",
                    )
                )
            except DomainError as exc:
                get_object_storage().delete(key=original_key)
                asset.status = MediaAsset.Status.REJECTED
                asset.actual_size = stored.size
                asset.save(update_fields=("status", "actual_size", "updated_at"))
                failure = exc
    if failure is not None:
        raise failure
    assert asset is not None
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

    if not uses_in_process_upload():
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
    object_key = build_object_key(
        organisation_id=context.organisation.public_id,
        purpose=purpose,
        public_id=public_id,
        original_name=original_name,
    )
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
    variant: str | None = None,
) -> str:
    asset = MediaAsset.objects.filter(
        public_id=public_id,
        organisation=context.organisation,
        status=MediaAsset.Status.READY,
    ).first()
    if asset is None:
        raise DomainError("NOT_FOUND", "No encontramos el recurso solicitado.", status=404)
    if uses_in_process_upload():
        url = asset_content_url(asset, variant=variant)
        if not url:
            raise DomainError("NOT_FOUND", "No encontramos el recurso solicitado.", status=404)
        return url
    return get_object_storage().presign_download(
        key=_object_key_for_variant(asset, variant),
        expires_in_seconds=300,
    )


def ready_asset(
    *,
    context: TenantContext,
    public_id: uuid.UUID,
    purpose: str | None = None,
    created_by: User | None = None,
) -> MediaAsset:
    query = MediaAsset.objects.filter(
        public_id=public_id,
        organisation=context.organisation,
        status=MediaAsset.Status.READY,
    )
    if purpose:
        query = query.filter(purpose=purpose)
    if created_by is not None:
        query = query.filter(created_by=created_by)
    asset = query.first()
    if asset is None:
        raise DomainError("NOT_FOUND", "No encontramos el recurso solicitado.", status=404)
    return asset


def asset_content_url(asset: MediaAsset | None, *, variant: str | None = None) -> str | None:
    if asset is None:
        return None
    origin = str(getattr(settings, "PUBLIC_API_URL", "") or "").rstrip("/")
    if not origin:
        origin = "http://localhost:8000"
    url = f"{origin}/api/v1/media/{asset.public_id}/content"
    if variant:
        return f"{url}?variant={variant}"
    return url


def read_ready_asset(
    *,
    context: TenantContext,
    public_id: uuid.UUID,
    variant: str | None = None,
) -> tuple[MediaAsset, bytes]:
    asset = ready_asset(context=context, public_id=public_id)
    content = get_object_storage().read_bytes(key=_object_key_for_variant(asset, variant))
    return asset, content


def stored_object_keys(asset: MediaAsset) -> list[str]:
    keys = [asset.object_key]
    for key in dict(asset.variants or {}).values():
        if key and key not in keys:
            keys.append(str(key))
    return keys


def delete_stored_objects(keys: list[str]) -> None:
    storage = get_object_storage()
    for key in keys:
        storage.delete(key=key)


def _object_key_for_variant(asset: MediaAsset, variant: str | None) -> str:
    allowed = tuple(getattr(settings, "IMAGE_VARIANT_NAMES", ("thumbnail", "medium", "large")))
    if variant and variant not in allowed:
        raise DomainError(
            "INVALID_IMAGE_VARIANT",
            "La versión de la imagen no es válida.",
            field_errors={"variant": ["Usa thumbnail, medium o large."]},
        )
    variants = dict(asset.variants or {})
    if variant and variant in variants:
        return str(variants[variant])
    return asset.object_key


def _replace_original_with_variants(asset: MediaAsset) -> None:
    storage = get_object_storage()
    original_key = asset.object_key
    rendered = render_image_variants(storage.read_bytes(key=original_key))
    variants: dict[str, str] = {}
    large_stored = None
    content_type = variant_content_type()
    for name, payload in rendered.items():
        digest = hashlib.sha256(payload).hexdigest()
        key = build_variant_key(
            organisation_id=asset.organisation.public_id,
            purpose=asset.purpose,
            public_id=asset.public_id,
            variant=name,
            content_hash=digest,
        )
        stored = storage.write_bytes(key=key, content=payload, content_type=content_type)
        variants[name] = key
        if name == "large":
            large_stored = stored
    storage.delete(key=original_key)
    if large_stored is None:
        raise DomainError("INVALID_IMAGE", "No pudimos generar las versiones de la imagen.")
    asset.object_key = variants["large"]
    asset.variants = variants
    asset.content_type = content_type
    asset.actual_size = large_stored.size
    asset.checksum_sha256 = large_stored.checksum_sha256
