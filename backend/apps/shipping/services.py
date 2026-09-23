"""Shipment lifecycle: paid-only creation, internal label, one-step dispatch registration."""

from __future__ import annotations

import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.db import transaction
from django.utils import timezone

from apps.audit.idempotency import execute_idempotent
from apps.audit.services import record_audit_event
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import create_generated_asset
from apps.notifications.outbox import enqueue_outbox_event
from apps.organisations.models import Membership
from apps.organisations.selectors import TenantContext
from apps.sales.models import Order
from tenda.errors import DomainError, ResourceNotFound

from .labels import render_internal_label_pdf
from .models import LabelDocument, Shipment
from .selectors import (
    buyer_email_for,
    order_is_paid,
    shipment_can_generate_label,
    shipment_label_field_errors,
)
from .selectors import shipment_for_context as load_shipment

LABEL_TTL = timedelta(hours=24)


@dataclass(frozen=True, slots=True)
class ShipmentResult:
    shipment: Shipment
    replayed: bool


@dataclass(frozen=True, slots=True)
class ShipmentCommandResult:
    shipment: Shipment
    replayed: bool


@dataclass(frozen=True, slots=True)
class LabelCommandResult:
    label: LabelDocument
    shipment: Shipment
    replayed: bool


def _require_paid(order: Order) -> None:
    if not order_is_paid(order):
        raise DomainError(
            "ORDER_NOT_PAID",
            "Un pedido impago no puede generar ni despachar un envío.",
            status=409,
        )


def ensure_shipment_for_paid_order(
    order: Order,
    *,
    actor: Any = None,
    correlation_id: str = "",
) -> ShipmentResult:
    """Create the shipment once when a sale is confirmed. Safe to call again."""

    _require_paid(order)
    existing = Shipment.objects.filter(order=order).first()
    if existing is not None:
        _ensure_internal_label(
            existing,
            actor=actor,
            correlation_id=correlation_id,
        )
        return ShipmentResult(shipment=existing, replayed=True)

    buyer = getattr(order, "buyer", None)
    recipient = str(getattr(buyer, "recipient_name", "") or getattr(buyer, "name", "") or "")
    shipment = Shipment.objects.create(
        organisation=order.organisation,
        inventory=order.inventory,
        order=order,
        number=f"ENV-{order.public_id.hex[:10].upper()}",
        status=Shipment.Status.PENDING,
        delivery_mode=order.delivery_mode,
        recipient_name=recipient,
        recipient_tax_id=str(getattr(buyer, "recipient_tax_id", "") or ""),
        address_line=str(getattr(buyer, "address_line", "") or ""),
        commune=str(getattr(buyer, "commune", "") or ""),
        region=str(getattr(buyer, "region", "") or ""),
        delivery_notes=str(getattr(buyer, "delivery_notes", "") or ""),
    )
    record_audit_event(
        action="shipping.shipment_created",
        organisation=order.organisation,
        actor=actor,
        object_type="shipping.shipment",
        object_public_id=str(shipment.public_id),
        correlation_id=correlation_id,
        metadata={"orderId": str(order.public_id)},
    )
    _ensure_internal_label(
        shipment,
        actor=actor,
        correlation_id=correlation_id,
    )
    return ShipmentResult(shipment=shipment, replayed=False)


def shipment_for_context(context: TenantContext, shipment_id: Any) -> Shipment:
    shipment = (
        Shipment.objects.filter(
            public_id=shipment_id,
            organisation=context.organisation,
            inventory=context.inventory,
        )
        .select_related("order", "order__buyer")
        .first()
    )
    if shipment is None:
        raise ResourceNotFound()
    return shipment


def _tenant_context_for_label(shipment: Shipment, actor: Any) -> TenantContext | None:
    if actor is not None:
        membership = (
            Membership.objects.filter(
                user=actor,
                organisation=shipment.organisation,
                is_active=True,
            )
            .select_related("user", "organisation")
            .first()
        )
        if membership is not None:
            return TenantContext(
                user=actor,
                organisation=shipment.organisation,
                membership=membership,
                inventory=shipment.inventory,
            )
    membership = (
        Membership.objects.filter(organisation=shipment.organisation)
        .select_related("user", "organisation")
        .order_by("created_at")
        .first()
    )
    if membership is None:
        return None
    return TenantContext(
        user=membership.user,
        organisation=shipment.organisation,
        membership=membership,
        inventory=shipment.inventory,
    )


def _ensure_internal_label(
    shipment: Shipment,
    *,
    actor: Any = None,
    correlation_id: str = "",
) -> None:
    if not shipment_can_generate_label(shipment):
        return
    context = _tenant_context_for_label(shipment, actor)
    if context is None:
        return
    try:
        _apply_generate_label(
            context,
            shipment_id=shipment.public_id,
            actor=context.user,
            correlation_id=correlation_id,
        )
    except DomainError:
        return


def _clean_text(value: object, *, maximum: int) -> str:
    return " ".join(str(value or "").split())[:maximum]


def _clean_url(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        URLValidator()(text)
    except DjangoValidationError as exc:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"trackingUrl": ["Ingresa una URL válida."]},
        ) from exc
    return text[:200]


def _order_lines(order: Order) -> list[dict[str, Any]]:
    return [
        {
            "productName": item.product_name,
            "quantity": item.quantity,
            "unitSalePrice": str(item.unit_sale_price),
            "lineTotal": str(item.line_total),
        }
        for item in order.items.all()
    ]


def _enqueue_dispatch_notification(shipment: Shipment) -> None:
    recipient = buyer_email_for(shipment)
    if not recipient:
        return
    order = shipment.order
    is_shipping = shipment.delivery_mode == Order.DeliveryMode.SHIPPING
    registered_at = shipment.dispatched_at if is_shipping else shipment.delivered_at
    payload: dict[str, Any] = {
        "recipient": recipient,
        "template": "shipment.dispatched" if is_shipping else "shipment.delivered",
        "parameters": {
            "shipmentNumber": shipment.number,
            "orderNumber": order.number,
            "status": shipment.status,
            "deliveryMode": shipment.delivery_mode,
            "carrier": shipment.carrier,
            "trackingCode": shipment.tracking_code,
            "actionUrl": shipment.tracking_url,
            "registeredAt": registered_at.isoformat() if registered_at else "",
            "note": shipment.dispatch_note,
            "recipientName": shipment.recipient_name,
            "addressLine": shipment.address_line,
            "commune": shipment.commune,
            "region": shipment.region,
            "total": str(order.total_amount),
            "items": _order_lines(order),
        },
    }
    enqueue_outbox_event(
        event_type="shipping.shipment_notification",
        payload=payload,
        organisation=shipment.organisation,
        aggregate_type="shipping.shipment",
        aggregate_public_id=str(shipment.public_id),
        deduplication_key=f"shipping.shipment:{shipment.public_id}:{shipment.status}",
    )


@transaction.atomic
def _apply_register_dispatch(
    context: TenantContext,
    *,
    shipment_id: uuid.UUID,
    payload: Mapping[str, Any],
    actor: Any,
    correlation_id: str,
) -> Shipment:
    shipment = (
        Shipment.objects.select_for_update()
        .filter(
            public_id=shipment_id,
            organisation=context.organisation,
            inventory=context.inventory,
        )
        .select_related("order", "order__buyer", "organisation")
        .prefetch_related("order__items")
        .first()
    )
    if shipment is None:
        raise ResourceNotFound()
    if shipment.status != Shipment.Status.PENDING:
        raise DomainError(
            "SHIPMENT_ALREADY_REGISTERED",
            "Este envío ya fue registrado.",
            status=409,
        )
    _require_paid(shipment.order)

    is_shipping = shipment.delivery_mode == Order.DeliveryMode.SHIPPING
    carrier = _clean_text(payload.get("carrier"), maximum=120) if is_shipping else ""
    tracking_code = _clean_text(payload.get("tracking_code"), maximum=120) if is_shipping else ""
    tracking_url = _clean_url(payload.get("tracking_url")) if is_shipping else ""
    note = _clean_text(payload.get("note"), maximum=500)
    if is_shipping and not carrier:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"carrier": ["Indica el transportista."]},
        )

    now = timezone.now()
    shipment.carrier = carrier
    shipment.tracking_code = tracking_code
    shipment.tracking_url = tracking_url
    shipment.dispatch_note = note
    if is_shipping:
        shipment.status = Shipment.Status.DISPATCHED
        shipment.dispatched_at = now
    else:
        shipment.status = Shipment.Status.DELIVERED
        shipment.delivered_at = now
    shipment.save(
        update_fields=(
            "status",
            "carrier",
            "tracking_code",
            "tracking_url",
            "dispatch_note",
            "dispatched_at",
            "delivered_at",
            "updated_at",
        )
    )
    record_audit_event(
        action=f"shipping.shipment_{shipment.status}",
        organisation=shipment.organisation,
        actor=actor,
        object_type="shipping.shipment",
        object_public_id=str(shipment.public_id),
        correlation_id=correlation_id,
        metadata={
            "fromStatus": Shipment.Status.PENDING,
            "toStatus": shipment.status,
            "carrier": carrier,
            "trackingCode": tracking_code,
        },
    )
    _enqueue_dispatch_notification(shipment)
    return shipment


def register_shipment_dispatch(
    *,
    context: TenantContext,
    shipment_id: uuid.UUID,
    payload: Mapping[str, Any],
    idempotency_key: str,
    correlation_id: str = "",
) -> ShipmentCommandResult:
    canonical = {
        "shipmentId": str(shipment_id),
        "carrier": payload.get("carrier") or "",
        "trackingCode": payload.get("tracking_code") or "",
        "trackingUrl": payload.get("tracking_url") or "",
        "note": payload.get("note") or "",
    }

    def command() -> tuple[dict[str, Any], int]:
        shipment = _apply_register_dispatch(
            context,
            shipment_id=shipment_id,
            payload=payload,
            actor=context.user,
            correlation_id=correlation_id,
        )
        return {"shipmentId": str(shipment.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="shipping.register_dispatch",
        key=idempotency_key,
        request_payload=canonical,
        command=command,
    )
    return ShipmentCommandResult(
        shipment=load_shipment(
            context,
            uuid.UUID(str(outcome.payload["shipmentId"])),
        ),
        replayed=outcome.replayed,
    )


def _label_for_context(context: TenantContext, label_id: uuid.UUID) -> LabelDocument:
    label = (
        LabelDocument.objects.filter(
            public_id=label_id,
            organisation=context.organisation,
            inventory=context.inventory,
        )
        .select_related("asset", "shipment", "shipment__order")
        .first()
    )
    if label is None:
        raise ResourceNotFound()
    return label


@transaction.atomic
def _apply_generate_label(
    context: TenantContext,
    *,
    shipment_id: uuid.UUID,
    actor: Any,
    correlation_id: str,
) -> LabelDocument:
    shipment = (
        Shipment.objects.select_for_update()
        .filter(
            public_id=shipment_id,
            organisation=context.organisation,
            inventory=context.inventory,
        )
        .select_related("order", "organisation")
        .prefetch_related("order__items")
        .first()
    )
    if shipment is None:
        raise ResourceNotFound()
    _require_paid(shipment.order)
    field_errors = shipment_label_field_errors(shipment)
    if field_errors:
        raise DomainError(
            "VALIDATION_ERROR",
            "Completa los datos requeridos antes de generar la etiqueta.",
            field_errors=field_errors,
        )
    latest = shipment.labels.select_related("asset").order_by("-created_at").first()
    if latest is not None and latest.expires_at > timezone.now():
        return latest
    pdf = render_internal_label_pdf(shipment)
    filename = f"etiqueta-interna-{shipment.number}.pdf"
    asset = create_generated_asset(
        context=context,
        purpose=MediaAsset.Purpose.SHIPPING_LABEL,
        original_name=filename,
        content_type="application/pdf",
        content=pdf,
    )
    label = LabelDocument.objects.create(
        organisation=shipment.organisation,
        inventory=shipment.inventory,
        shipment=shipment,
        asset=asset,
        expires_at=timezone.now() + LABEL_TTL,
    )
    record_audit_event(
        action="shipping.label_generated",
        organisation=shipment.organisation,
        actor=actor,
        object_type="shipping.label_document",
        object_public_id=str(label.public_id),
        correlation_id=correlation_id,
        metadata={"shipmentId": str(shipment.public_id), "assetId": str(asset.public_id)},
    )
    return label


def generate_shipment_label(
    *,
    context: TenantContext,
    shipment_id: uuid.UUID,
    idempotency_key: str,
    correlation_id: str = "",
) -> LabelCommandResult:
    def command() -> tuple[dict[str, Any], int]:
        label = _apply_generate_label(
            context,
            shipment_id=shipment_id,
            actor=context.user,
            correlation_id=correlation_id,
        )
        return {
            "labelId": str(label.public_id),
            "shipmentId": str(label.shipment.public_id),
        }, 200

    outcome = execute_idempotent(
        context=context,
        scope="shipping.generate_label",
        key=idempotency_key,
        request_payload={"shipmentId": str(shipment_id)},
        command=command,
    )
    return LabelCommandResult(
        label=_label_for_context(context, uuid.UUID(str(outcome.payload["labelId"]))),
        shipment=load_shipment(
            context,
            uuid.UUID(str(outcome.payload["shipmentId"])),
        ),
        replayed=outcome.replayed,
    )
