"""Shipment lifecycle: paid-only creation, guarded transitions, durable timeline."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from django.db import IntegrityError, transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.audit.idempotency import execute_idempotent
from apps.audit.services import record_audit_event
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import create_generated_asset
from apps.notifications.outbox import enqueue_outbox_event
from apps.organisations.models import Membership
from apps.organisations.selectors import TenantContext
from apps.sales.models import Order
from tenda.crypto import decrypt_credential, encrypt_credential
from tenda.errors import DomainError, ResourceNotFound

from .labels import INTERNAL_LABEL_TITLE, render_internal_label_pdf
from .models import (
    DeliveryConfirmation,
    LabelDocument,
    Shipment,
    ShipmentEvent,
    Ticket,
    TicketMessage,
)
from .selectors import (
    CONFIRMABLE_STATUSES,
    EDITABLE_STATUSES,
    shipment_can_generate_label,
    shipment_label_field_errors,
)
from .selectors import shipment_for_context as load_shipment

TRANSITIONS: dict[str, frozenset[str]] = {
    Shipment.Status.PENDING: frozenset({Shipment.Status.PREPARING, Shipment.Status.CANCELLED}),
    Shipment.Status.PREPARING: frozenset({Shipment.Status.DISPATCHED, Shipment.Status.CANCELLED}),
    Shipment.Status.DISPATCHED: frozenset(
        {
            Shipment.Status.DELIVERY_CHECK,
            Shipment.Status.DELIVERED,
            Shipment.Status.ISSUE,
            Shipment.Status.RETURNED,
        }
    ),
    Shipment.Status.DELIVERY_CHECK: frozenset(
        {
            Shipment.Status.DELIVERED,
            Shipment.Status.ISSUE,
            Shipment.Status.RETURNED,
        }
    ),
    Shipment.Status.DELIVERED: frozenset(
        {Shipment.Status.CLOSED, Shipment.Status.ISSUE, Shipment.Status.RETURNED}
    ),
    Shipment.Status.ISSUE: frozenset(
        {
            Shipment.Status.DISPATCHED,
            Shipment.Status.DELIVERY_CHECK,
            Shipment.Status.DELIVERED,
            Shipment.Status.RETURNED,
            Shipment.Status.CLOSED,
        }
    ),
    Shipment.Status.RETURNED: frozenset({Shipment.Status.CLOSED}),
    Shipment.Status.CANCELLED: frozenset({Shipment.Status.CLOSED}),
    Shipment.Status.CLOSED: frozenset(),
}

STATUS_TITLES: dict[str, str] = {
    Shipment.Status.PENDING: "Envío creado",
    Shipment.Status.PREPARING: "Preparación iniciada",
    Shipment.Status.DISPATCHED: "Pedido despachado",
    Shipment.Status.DELIVERY_CHECK: "Chequeo de entrega",
    Shipment.Status.DELIVERED: "Entrega confirmada",
    Shipment.Status.ISSUE: "Incidencia registrada",
    Shipment.Status.RETURNED: "Devolución registrada",
    Shipment.Status.CANCELLED: "Envío cancelado",
    Shipment.Status.CLOSED: "Envío cerrado",
}


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


@dataclass(frozen=True, slots=True)
class PublicConfirmResult:
    shipment: Shipment
    confirmation: DeliveryConfirmation
    replayed: bool


def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _require_paid(order: Order) -> None:
    if order.status != Order.Status.PAID or order.paid_at is None:
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
    token = secrets.token_urlsafe(32)
    ttl_days = int(getattr(settings, "SHIPPING_PUBLIC_TOKEN_TTL_DAYS", 90))
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
        public_token_hash=_token_digest(token),
        public_token_ciphertext=encrypt_credential(token),
        public_token_expires_at=timezone.now() + timedelta(days=max(ttl_days, 1)),
    )
    _append_event(
        shipment,
        event_type="shipment.created",
        title=STATUS_TITLES[Shipment.Status.PENDING],
        detail="La venta confirmada generó el envío.",
        actor=actor,
        from_status="",
        to_status=Shipment.Status.PENDING,
        correlation_id=correlation_id,
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


def _public_origin() -> str:
    return str(getattr(settings, "PUBLIC_ORIGIN", settings.WEB_ORIGIN)).rstrip("/")


def public_shipment_url(shipment: Shipment) -> str:
    token = decrypt_credential(shipment.public_token_ciphertext)
    return f"{_public_origin()}/s/{token}"


def _public_shipment_queryset() -> QuerySet[Shipment]:
    return Shipment.objects.select_related(
        "order",
        "order__buyer",
        "organisation",
        "inventory",
        "delivery_confirmation",
    ).prefetch_related(
        "order__items",
        "timeline",
        "tickets",
        "tickets__messages",
        "tickets__messages__actor",
    )


def public_shipment_for_token(token: str) -> Shipment:
    clean_token = token.strip()
    if not clean_token or len(clean_token) > 256:
        raise ResourceNotFound()
    shipment = (
        _public_shipment_queryset().filter(public_token_hash=_token_digest(clean_token)).first()
    )
    if shipment is None:
        raise ResourceNotFound()
    if shipment.public_token_expires_at <= timezone.now():
        raise DomainError(
            "PUBLIC_TOKEN_EXPIRED",
            "Este enlace ya no está disponible.",
            status=404,
        )
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
    try:
        return _context_for_shipment(shipment)
    except DomainError:
        return None


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


def _context_for_shipment(shipment: Shipment) -> TenantContext:
    membership = (
        Membership.objects.filter(organisation=shipment.organisation)
        .select_related("user", "organisation")
        .order_by("created_at")
        .first()
    )
    if membership is None:
        raise DomainError(
            "SHIPMENT_CONTEXT_UNAVAILABLE",
            "No pudimos completar la operación del envío.",
            status=409,
            retryable=True,
        )
    return TenantContext(
        user=membership.user,
        organisation=shipment.organisation,
        membership=membership,
        inventory=shipment.inventory,
    )


def _apply_status_change(
    shipment: Shipment,
    *,
    target: str,
    comment: str = "",
    actor: Any = None,
    correlation_id: str = "",
    internal_note: bool = False,
) -> ShipmentResult:
    if target == Shipment.Status.DISPATCHED:
        _require_paid(shipment.order)
    if shipment.status == target:
        return ShipmentResult(shipment=shipment, replayed=True)
    if target not in TRANSITIONS.get(shipment.status, frozenset()):
        raise DomainError(
            "SHIPMENT_TRANSITION_NOT_ALLOWED",
            "El envío ya no permite esta acción.",
            status=409,
        )
    previous = shipment.status
    now = timezone.now()
    shipment.status = target
    update_fields = ["status", "updated_at"]
    if target == Shipment.Status.DISPATCHED:
        shipment.dispatched_at = now
        update_fields.append("dispatched_at")
    elif target == Shipment.Status.DELIVERED:
        shipment.delivered_at = now
        update_fields.append("delivered_at")
    elif target == Shipment.Status.CLOSED:
        shipment.closed_at = now
        update_fields.append("closed_at")
    shipment.save(update_fields=tuple(update_fields))
    _append_event(
        shipment,
        event_type=f"shipment.{target}",
        title=STATUS_TITLES[target],
        detail=comment,
        actor=actor,
        from_status=previous,
        to_status=target,
        is_public=not internal_note,
        correlation_id=correlation_id,
    )
    _enqueue_transition_notification(
        shipment,
        from_status=previous,
        to_status=target,
    )
    record_audit_event(
        action=f"shipping.shipment_{target}",
        organisation=shipment.organisation,
        actor=actor,
        object_type="shipping.shipment",
        object_public_id=str(shipment.public_id),
        correlation_id=correlation_id,
        metadata={"fromStatus": previous, "toStatus": target},
    )
    from .cadences import sync_shipment_cadences

    sync_shipment_cadences(shipment)
    return ShipmentResult(shipment=shipment, replayed=False)


@transaction.atomic
def transition_shipment(
    context: TenantContext,
    *,
    shipment_id: Any,
    target: str,
    comment: str = "",
    actor: Any = None,
    correlation_id: str = "",
    internal_note: bool = False,
) -> ShipmentResult:
    shipment = (
        Shipment.objects.select_for_update()
        .filter(
            public_id=shipment_id,
            organisation=context.organisation,
            inventory=context.inventory,
        )
        .select_related("order")
        .first()
    )
    if shipment is None:
        raise ResourceNotFound()
    return _apply_status_change(
        shipment,
        target=target,
        comment=comment,
        actor=actor,
        correlation_id=correlation_id,
        internal_note=internal_note,
    )


def _append_event(
    shipment: Shipment,
    *,
    event_type: str,
    title: str,
    detail: str,
    actor: Any,
    from_status: str,
    to_status: str,
    is_public: bool = True,
    correlation_id: str = "",
) -> ShipmentEvent:
    del correlation_id
    return ShipmentEvent.objects.create(
        shipment=shipment,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        title=title,
        detail=detail,
        is_public=is_public,
        actor=actor,
    )


def _enqueue_transition_notification(
    shipment: Shipment,
    *,
    from_status: str,
    to_status: str,
) -> None:
    buyer = getattr(shipment.order, "buyer", None)
    recipient = str(getattr(buyer, "email", "") or "")
    if not recipient:
        return
    enqueue_outbox_event(
        event_type="shipping.shipment_notification",
        payload={
            "recipient": recipient,
            "template": f"shipment.{to_status}",
            "parameters": {
                "shipmentNumber": shipment.number,
                "orderNumber": shipment.order.number,
                "status": to_status,
            },
        },
        organisation=shipment.organisation,
        aggregate_type="shipping.shipment",
        aggregate_public_id=str(shipment.public_id),
        deduplication_key=(
            f"shipping.shipment:{shipment.public_id}:transition:{from_status}:{to_status}"
        ),
    )


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


def _optional_text(
    payload: Mapping[str, Any],
    key: str,
    current: str,
    *,
    maximum: int,
) -> str:
    if key not in payload or payload[key] is None:
        return current
    return _clean_text(payload[key], maximum=maximum)


@transaction.atomic
def _apply_shipment_update(
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
        .select_related("order")
        .first()
    )
    if shipment is None:
        raise ResourceNotFound()
    if shipment.status not in EDITABLE_STATUSES:
        raise DomainError(
            "SHIPMENT_NOT_EDITABLE",
            "El envío ya no admite cambios de transportista o tracking.",
            status=409,
        )
    carrier = _optional_text(payload, "carrier", shipment.carrier, maximum=120)
    tracking_code = _optional_text(
        payload,
        "tracking_code",
        shipment.tracking_code,
        maximum=120,
    )
    if "tracking_url" not in payload or payload["tracking_url"] is None:
        tracking_url = shipment.tracking_url
    else:
        tracking_url = _clean_url(payload["tracking_url"])
    comment = _clean_text(payload.get("comment") or "", maximum=500)
    internal_note = bool(payload.get("internal_note"))
    fields_changed = (
        carrier != shipment.carrier
        or tracking_code != shipment.tracking_code
        or tracking_url != shipment.tracking_url
    )
    if fields_changed:
        shipment.carrier = carrier
        shipment.tracking_code = tracking_code
        shipment.tracking_url = tracking_url
        shipment.save(update_fields=("carrier", "tracking_code", "tracking_url", "updated_at"))
        record_audit_event(
            action="shipping.shipment_updated",
            organisation=shipment.organisation,
            actor=actor,
            object_type="shipping.shipment",
            object_public_id=str(shipment.public_id),
            correlation_id=correlation_id,
            metadata={"carrier": carrier, "trackingCode": tracking_code},
        )
    if shipment.status == Shipment.Status.PENDING:
        return transition_shipment(
            context,
            shipment_id=shipment.public_id,
            target=Shipment.Status.PREPARING,
            comment=comment or "Preparación iniciada al guardar el seguimiento.",
            actor=actor,
            correlation_id=correlation_id,
            internal_note=internal_note,
        ).shipment
    if fields_changed or comment:
        _append_event(
            shipment,
            event_type="shipment.updated",
            title="Datos de seguimiento actualizados",
            detail=comment,
            actor=actor,
            from_status=shipment.status,
            to_status=shipment.status,
            is_public=not internal_note,
            correlation_id=correlation_id,
        )
    return shipment


def update_shipment(
    *,
    context: TenantContext,
    shipment_id: uuid.UUID,
    payload: Mapping[str, Any],
    idempotency_key: str,
    correlation_id: str = "",
) -> ShipmentCommandResult:
    canonical = {
        "shipmentId": str(shipment_id),
        "carrier": payload.get("carrier"),
        "trackingCode": payload.get("tracking_code", payload.get("trackingCode")),
        "trackingUrl": payload.get("tracking_url", payload.get("trackingUrl")),
        "comment": payload.get("comment") or "",
        "internalNote": bool(payload.get("internal_note", payload.get("internalNote"))),
    }

    def command() -> tuple[dict[str, Any], int]:
        shipment = _apply_shipment_update(
            context,
            shipment_id=shipment_id,
            payload=payload,
            actor=context.user,
            correlation_id=correlation_id,
        )
        return {"shipmentId": str(shipment.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="shipping.update_shipment",
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


@transaction.atomic
def _apply_dispatch(
    context: TenantContext,
    *,
    shipment_id: uuid.UUID,
    comment: str,
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
        .select_related("order")
        .first()
    )
    if shipment is None:
        raise ResourceNotFound()
    if shipment.status == Shipment.Status.PENDING:
        transition_shipment(
            context,
            shipment_id=shipment.public_id,
            target=Shipment.Status.PREPARING,
            comment="Preparación iniciada al marcar despacho.",
            actor=actor,
            correlation_id=correlation_id,
        )
    return transition_shipment(
        context,
        shipment_id=shipment.public_id,
        target=Shipment.Status.DISPATCHED,
        comment=comment,
        actor=actor,
        correlation_id=correlation_id,
    ).shipment


def mark_shipment_dispatched(
    *,
    context: TenantContext,
    shipment_id: uuid.UUID,
    idempotency_key: str,
    comment: str = "",
    correlation_id: str = "",
) -> ShipmentCommandResult:
    def command() -> tuple[dict[str, Any], int]:
        shipment = _apply_dispatch(
            context,
            shipment_id=shipment_id,
            comment=_clean_text(comment, maximum=500),
            actor=context.user,
            correlation_id=correlation_id,
        )
        return {"shipmentId": str(shipment.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="shipping.mark_dispatched",
        key=idempotency_key,
        request_payload={"shipmentId": str(shipment_id), "comment": comment or ""},
        command=command,
    )
    return ShipmentCommandResult(
        shipment=load_shipment(
            context,
            uuid.UUID(str(outcome.payload["shipmentId"])),
        ),
        replayed=outcome.replayed,
    )


LABEL_TTL = timedelta(hours=24)


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
    _append_event(
        shipment,
        event_type="shipment.label_generated",
        title="Etiqueta interna generada",
        detail=INTERNAL_LABEL_TITLE,
        actor=actor,
        from_status=shipment.status,
        to_status=shipment.status,
        is_public=False,
        correlation_id=correlation_id,
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


def _load_public_shipment(shipment_id: uuid.UUID) -> Shipment:
    shipment = _public_shipment_queryset().filter(public_id=shipment_id).first()
    if shipment is None:
        raise ResourceNotFound()
    return shipment


@transaction.atomic
def _apply_public_confirmation(
    *,
    token: str,
    outcome: str,
    comment: str,
    correlation_id: str,
) -> PublicConfirmResult:
    visible = public_shipment_for_token(token)
    shipment = (
        Shipment.objects.select_for_update()
        .select_related("order", "order__buyer", "organisation", "inventory")
        .filter(pk=visible.pk)
        .first()
    )
    if shipment is None:
        raise ResourceNotFound()
    existing = DeliveryConfirmation.objects.select_for_update().filter(shipment=shipment).first()
    if existing is not None:
        return PublicConfirmResult(
            shipment=_load_public_shipment(shipment.public_id),
            confirmation=existing,
            replayed=True,
        )
    if outcome not in {
        DeliveryConfirmation.Outcome.RECEIVED,
        DeliveryConfirmation.Outcome.NEEDS_HELP,
    }:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"outcome": ["Elige si recibiste el pedido o si necesitas ayuda."]},
        )
    if shipment.status not in CONFIRMABLE_STATUSES:
        raise DomainError(
            "SHIPMENT_NOT_CONFIRMABLE",
            "Este envío todavía no se puede confirmar.",
            status=409,
        )
    note = _clean_text(comment, maximum=500)
    try:
        with transaction.atomic():
            confirmation = DeliveryConfirmation.objects.create(
                shipment=shipment,
                outcome=outcome,
                comment=note,
            )
    except IntegrityError:
        current = DeliveryConfirmation.objects.get(shipment=shipment)
        return PublicConfirmResult(
            shipment=_load_public_shipment(shipment.public_id),
            confirmation=current,
            replayed=True,
        )
    if outcome == DeliveryConfirmation.Outcome.RECEIVED:
        _apply_status_change(
            shipment,
            target=Shipment.Status.DELIVERED,
            comment=note or "El comprador confirmó la recepción.",
            actor=None,
            correlation_id=correlation_id,
        )
    else:
        _append_event(
            shipment,
            event_type="shipment.buyer_needs_help",
            title="El comprador indicó que necesita ayuda",
            detail=note,
            actor=None,
            from_status=shipment.status,
            to_status=shipment.status,
            is_public=True,
            correlation_id=correlation_id,
        )
        record_audit_event(
            action="shipping.buyer_needs_help",
            organisation=shipment.organisation,
            actor=None,
            object_type="shipping.shipment",
            object_public_id=str(shipment.public_id),
            correlation_id=correlation_id,
            metadata={"outcome": outcome},
        )
        from .tickets import ensure_open_ticket

        buyer = getattr(shipment.order, "buyer", None)
        ensure_open_ticket(
            shipment,
            category=Ticket.Category.OTHER,
            message=note or "El comprador indicó que necesita ayuda.",
            author_kind=TicketMessage.AuthorKind.SYSTEM,
            contact_name=str(getattr(buyer, "name", "") or shipment.recipient_name or ""),
            contact_email=str(getattr(buyer, "email", "") or ""),
            contact_phone=str(getattr(buyer, "phone", "") or ""),
            correlation_id=correlation_id,
        )
    return PublicConfirmResult(
        shipment=_load_public_shipment(shipment.public_id),
        confirmation=confirmation,
        replayed=False,
    )


def confirm_public_shipment(
    *,
    token: str,
    outcome: str,
    comment: str = "",
    idempotency_key: str = "",
    correlation_id: str = "",
) -> PublicConfirmResult:
    if not idempotency_key.strip():
        return _apply_public_confirmation(
            token=token,
            outcome=outcome,
            comment=comment,
            correlation_id=correlation_id,
        )
    shipment = public_shipment_for_token(token)

    def command() -> tuple[dict[str, Any], int]:
        result = _apply_public_confirmation(
            token=token,
            outcome=outcome,
            comment=comment,
            correlation_id=correlation_id,
        )
        return {
            "shipmentId": str(result.shipment.public_id),
            "confirmationId": str(result.confirmation.public_id),
            "replayed": result.replayed,
        }, 200

    stored = execute_idempotent(
        context=_context_for_shipment(shipment),
        scope="shipping.public_confirm",
        key=idempotency_key,
        request_payload={
            "token": token,
            "outcome": outcome,
            "comment": comment or "",
        },
        command=command,
    )
    loaded = _load_public_shipment(uuid.UUID(str(stored.payload["shipmentId"])))
    confirmation = DeliveryConfirmation.objects.get(public_id=stored.payload["confirmationId"])
    return PublicConfirmResult(
        shipment=loaded,
        confirmation=confirmation,
        replayed=stored.replayed or bool(stored.payload.get("replayed")),
    )
