"""Order-token-scoped receipt uploads over the private MediaAsset lifecycle."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from django.db import transaction

from apps.media_assets.keys import build_object_key
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import _validate_upload
from apps.media_assets.storage import PresignedUpload, get_object_storage, uses_in_process_upload
from tenda.errors import DomainError, ResourceNotFound

from .models import Order, Payment, PaymentProof
from .order_services import mark_payment_proof_ready, public_order_for_token


@dataclass(frozen=True, slots=True)
class PreparedReceiptUpload:
    order: Order
    proof: PaymentProof
    asset: MediaAsset
    upload: PresignedUpload


def _require_transfer_upload(order: Order) -> None:
    if order.payment_method != Order.PaymentMethod.BANK_TRANSFER:
        raise DomainError(
            "PAYMENT_METHOD_NOT_ALLOWED",
            "Este pedido no admite comprobante de transferencia.",
            status=409,
        )
    if order.status not in {
        Order.Status.RESERVED,
        Order.Status.PURCHASE_IN_PROGRESS,
    }:
        raise DomainError(
            "ORDER_TRANSITION_NOT_ALLOWED",
            "El pedido ya no permite cargar un comprobante.",
            status=409,
        )


@transaction.atomic
def prepare_receipt_upload(
    *,
    token: str,
    original_name: str,
    content_type: str,
    size: int,
) -> PreparedReceiptUpload:
    _validate_upload(
        purpose=MediaAsset.Purpose.PAYMENT_RECEIPT,
        content_type=content_type,
        size=size,
    )
    visible_order = public_order_for_token(token)
    order = (
        Order.objects.select_for_update(of=("self",))
        .select_related("organisation", "created_by")
        .get(pk=visible_order.pk)
    )
    _require_transfer_upload(order)
    payment, _created = Payment.objects.select_for_update().get_or_create(
        order=order,
        defaults={
            "organisation": order.organisation,
            "method": order.payment_method,
            "amount": order.total_amount,
        },
    )
    existing = PaymentProof.objects.select_for_update().filter(payment=payment).first()
    if existing is not None and existing.status != PaymentProof.Status.PENDING:
        raise DomainError(
            "PAYMENT_PROOF_ALREADY_UPLOADED",
            "Ya existe un comprobante para este pedido.",
            status=409,
        )

    public_id = uuid.uuid4()
    object_key = build_object_key(
        organisation_id=order.organisation.public_id,
        purpose=MediaAsset.Purpose.PAYMENT_RECEIPT,
        public_id=public_id,
        original_name=original_name,
        extra=str(order.public_id),
    )
    asset = MediaAsset.objects.create(
        public_id=public_id,
        organisation=order.organisation,
        created_by=order.created_by,
        purpose=MediaAsset.Purpose.PAYMENT_RECEIPT,
        object_key=object_key,
        original_name=Path(original_name).name[:255],
        content_type=content_type,
        expected_size=size,
    )
    if existing is None:
        proof = PaymentProof.objects.create(payment=payment, asset=asset)
    else:
        proof = existing
        proof.asset = asset
        proof.save(update_fields=("asset", "updated_at"))
    upload = get_object_storage().presign_upload(
        key=asset.object_key,
        content_type=content_type,
        size=size,
        expires_in_seconds=900,
    )
    return PreparedReceiptUpload(
        order=order,
        proof=proof,
        asset=asset,
        upload=upload,
    )


def _scoped_asset(*, token: str, asset_id: uuid.UUID) -> tuple[Order, PaymentProof, MediaAsset]:
    order = public_order_for_token(token)
    proof = (
        PaymentProof.objects.select_related("payment", "asset")
        .filter(
            payment__order=order,
            asset__public_id=asset_id,
            asset__organisation=order.organisation,
            asset__purpose=MediaAsset.Purpose.PAYMENT_RECEIPT,
        )
        .first()
    )
    if proof is None:
        raise ResourceNotFound()
    return order, proof, proof.asset


@transaction.atomic
def accept_fake_receipt_upload(
    *,
    token: str,
    asset_id: uuid.UUID,
    content: bytes,
    content_type: str,
) -> MediaAsset:
    if not uses_in_process_upload():
        raise ResourceNotFound()
    order, proof, asset = _scoped_asset(token=token, asset_id=asset_id)
    del order, proof
    asset = MediaAsset.objects.select_for_update().get(pk=asset.pk)
    if asset.status != MediaAsset.Status.PENDING:
        raise DomainError(
            "ORDER_TRANSITION_NOT_ALLOWED",
            "La carga ya no está disponible.",
            status=409,
        )
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
def complete_receipt_upload(
    *,
    token: str,
    asset_id: uuid.UUID,
    correlation_id: str = "",
) -> PaymentProof:
    order, proof, asset = _scoped_asset(token=token, asset_id=asset_id)
    order = Order.objects.select_for_update().get(pk=order.pk)
    Payment.objects.select_for_update().get(pk=proof.payment_id)
    proof = PaymentProof.objects.select_for_update().get(pk=proof.pk)
    asset = MediaAsset.objects.select_for_update().get(pk=asset.pk)
    if proof.status == PaymentProof.Status.READY and asset.status == MediaAsset.Status.READY:
        return proof
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
    mark_payment_proof_ready(
        order=order,
        proof=proof,
        correlation_id=correlation_id,
    )
    proof.refresh_from_db()
    return proof
