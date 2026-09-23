"""Transactional sales commands and state-machine invariants."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Prefetch, QuerySet
from django.utils import timezone

from apps.audit.idempotency import execute_idempotent
from apps.audit.services import record_audit_event
from apps.configuration.services import parameter_value
from apps.inventory.models import Product
from apps.inventory.services import (
    StockRequest,
    clean_reference_price,
    consume_stock,
    release_stock,
    reserve_stock,
)
from apps.notifications.outbox import enqueue_outbox_event
from apps.organisations.bank import format_rut, is_valid_rut
from apps.organisations.models import Membership
from apps.organisations.selectors import TenantContext
from apps.sales.chile import chile_communes_by_region, is_valid_chile_location
from apps.shipping.models import LabelDocument
from tenda.crypto import decrypt_credential, encrypt_credential, encrypt_outbox_value
from tenda.errors import DomainError, ResourceNotFound

from .models import (
    BuyerSnapshot,
    Order,
    OrderEvent,
    OrderItem,
    Payment,
    PaymentProof,
    ReconciliationIssue,
    SellerPaymentConnection,
    StockReservation,
)
from .payments import PaymentPreferenceInput, PaymentSnapshot, get_payment_provider

MAX_LINE_QUANTITY = 1_000_000
MAX_ORDER_TOTAL = Decimal("99999999999999")
ACTIVE_ORDER_STATUSES = frozenset(
    {
        Order.Status.RESERVED,
        Order.Status.PURCHASE_IN_PROGRESS,
        Order.Status.PURCHASE_VALIDATION,
    }
)
EXPIRABLE_ORDER_STATUSES = frozenset(
    {
        Order.Status.RESERVED,
        Order.Status.PURCHASE_IN_PROGRESS,
    }
)
TRANSITIONS: dict[str, frozenset[str]] = {
    Order.Status.DRAFT: frozenset({Order.Status.RESERVED, Order.Status.CANCELLED}),
    Order.Status.RESERVED: frozenset(
        {
            Order.Status.PURCHASE_IN_PROGRESS,
            Order.Status.PURCHASE_VALIDATION,
            Order.Status.PAID,
            Order.Status.CANCELLED,
            Order.Status.EXPIRED,
        }
    ),
    Order.Status.PURCHASE_IN_PROGRESS: frozenset(
        {
            Order.Status.PURCHASE_VALIDATION,
            Order.Status.PAID,
            Order.Status.CANCELLED,
            Order.Status.EXPIRED,
        }
    ),
    Order.Status.PURCHASE_VALIDATION: frozenset(
        {
            Order.Status.PAID,
            Order.Status.CANCELLED,
        }
    ),
    Order.Status.PAID: frozenset({Order.Status.REFUNDED}),
    Order.Status.CANCELLED: frozenset(
        {
            Order.Status.RESERVED,
            Order.Status.PURCHASE_IN_PROGRESS,
            Order.Status.PURCHASE_VALIDATION,
        }
    ),
    Order.Status.EXPIRED: frozenset(),
    Order.Status.REFUNDED: frozenset(),
}


@dataclass(frozen=True, slots=True)
class OrderCommandResult:
    order: Order
    replayed: bool


@dataclass(frozen=True, slots=True)
class CheckoutResult:
    order: Order
    payment: Payment
    checkout_url: str
    replayed: bool


def _clean_text(value: object, *, maximum: int) -> str:
    return " ".join(str(value or "").split())[:maximum]


def _clean_required_text(
    value: object,
    *,
    field: str,
    maximum: int,
    message: str,
) -> str:
    cleaned = _clean_text(value, maximum=maximum)
    if not cleaned:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={field: [message]},
        )
    return cleaned


def _chile_location_errors(
    region: str,
    commune: str,
    *,
    required: bool,
    region_field: str = "region",
    commune_field: str = "commune",
) -> dict[str, list[str]]:
    errors: dict[str, list[str]] = {}
    if required and not region:
        errors[region_field] = ["Selecciona la región."]
    if required and not commune:
        errors[commune_field] = ["Selecciona la comuna."]
    if not region and not commune:
        return errors
    if is_valid_chile_location(region, commune):
        return errors
    if region not in chile_communes_by_region():
        errors.setdefault(region_field, ["Selecciona una región válida."])
    if commune:
        errors.setdefault(commune_field, ["Selecciona una comuna de esa región."])
    else:
        errors.setdefault(commune_field, ["Selecciona la comuna."])
    return errors


def _clean_quantity(value: object, *, index: int) -> int:
    if isinstance(value, bool):
        quantity = 0
    else:
        try:
            quantity = int(str(value).strip())
        except (TypeError, ValueError):
            quantity = 0
    if quantity <= 0 or quantity > MAX_LINE_QUANTITY:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={f"lines.{index}.quantity": ["Ingresa una cantidad positiva válida."]},
        )
    return quantity


def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_public_token() -> str:
    return secrets.token_urlsafe(32)


def _reservation_ttl(*, organisation=None) -> timedelta:
    hours = parameter_value(
        "sales.reservation_ttl_hours",
        organisation=organisation,
        default=0,
    )
    try:
        hours_value = int(hours)
    except (TypeError, ValueError):
        hours_value = 0
    if hours_value > 0:
        return timedelta(hours=hours_value)
    seconds = int(getattr(settings, "SALES_RESERVATION_TTL_SECONDS", 8 * 60 * 60))
    return timedelta(seconds=max(seconds, 60))


def _public_origin() -> str:
    return str(getattr(settings, "PUBLIC_ORIGIN", settings.WEB_ORIGIN)).rstrip("/")


def public_order_url(order: Order) -> str:
    token = decrypt_credential(order.public_token_ciphertext)
    return f"{_public_origin()}/p/{token}"


def _public_api_origin() -> str:
    origin = str(getattr(settings, "PUBLIC_API_URL", "") or "").rstrip("/")
    return origin or "http://localhost:8000"


def public_order_token(order: Order) -> str:
    return decrypt_credential(order.public_token_ciphertext)


def public_order_media_url(
    order: Order,
    asset_id: uuid.UUID,
    *,
    variant: str = "medium",
) -> str:
    token = public_order_token(order)
    url = f"{_public_api_origin()}/api/v1/public/orders/{token}/media/{asset_id}"
    if variant:
        return f"{url}?variant={variant}"
    return url


def _context_for_order(order: Order) -> TenantContext:
    membership = (
        Membership.objects.filter(
            organisation=order.organisation,
            user=order.created_by,
        )
        .select_related("user", "organisation")
        .first()
        or Membership.objects.filter(organisation=order.organisation)
        .select_related("user", "organisation")
        .order_by("created_at")
        .first()
    )
    if membership is None:
        raise DomainError(
            "ORDER_CONTEXT_UNAVAILABLE",
            "No pudimos completar la operación del pedido.",
            status=409,
            retryable=True,
        )
    return TenantContext(
        user=membership.user,
        organisation=order.organisation,
        membership=membership,
        inventory=order.inventory,
    )


def _order_queryset() -> QuerySet[Order]:
    return Order.objects.select_related(
        "organisation",
        "inventory",
        "created_by",
        "buyer",
        "payment",
        "payment__proof",
        "payment__proof__asset",
        "shipment",
    ).prefetch_related(
        "items",
        "items__product",
        "reservations",
        "timeline",
        "reconciliation_issues",
        Prefetch(
            "shipment__labels",
            queryset=LabelDocument.objects.select_related("asset").order_by("-created_at"),
        ),
    )


def order_for_context(context: TenantContext, order_id: uuid.UUID) -> Order:
    order = (
        _order_queryset()
        .filter(
            organisation=context.organisation,
            inventory=context.inventory,
            public_id=order_id,
        )
        .first()
    )
    if order is None:
        raise ResourceNotFound()
    return order


def public_order_for_token(token: str, *, expire_if_due: bool = True) -> Order:
    clean_token = token.strip()
    if not clean_token or len(clean_token) > 256:
        raise ResourceNotFound()
    order = _order_queryset().filter(public_token_hash=_token_digest(clean_token)).first()
    if order is None:
        raise ResourceNotFound()
    if expire_if_due and order.status in EXPIRABLE_ORDER_STATUSES:
        if order.reservation_expires_at <= timezone.now():
            expire_order(order.pk)
            order = _order_queryset().get(pk=order.pk)
    return order


def _append_event(
    *,
    order: Order,
    event_type: str,
    title: str,
    detail: str = "",
    actor: Any = None,
    from_status: str = "",
    to_status: str = "",
    metadata: Mapping[str, Any] | None = None,
    correlation_id: str = "",
) -> OrderEvent:
    return OrderEvent.objects.create(
        order=order,
        event_type=event_type,
        title=title[:160],
        detail=detail[:500],
        actor=actor,
        from_status=from_status,
        to_status=to_status,
        metadata=dict(metadata or {}),
        correlation_id=correlation_id[:100],
    )


def _audit_order(
    *,
    order: Order,
    action: str,
    actor: Any = None,
    correlation_id: str = "",
    metadata: Mapping[str, Any] | None = None,
) -> None:
    record_audit_event(
        action=action,
        organisation=order.organisation,
        actor=actor,
        object_type="sales.order",
        object_public_id=str(order.public_id),
        correlation_id=correlation_id,
        metadata=metadata,
    )


def _transition_order(
    order: Order,
    target: str,
    *,
    event_type: str,
    title: str,
    detail: str = "",
    actor: Any = None,
    correlation_id: str = "",
    metadata: Mapping[str, Any] | None = None,
) -> bool:
    if order.status == target:
        return False
    if target not in TRANSITIONS.get(order.status, frozenset()):
        raise DomainError(
            "ORDER_TRANSITION_NOT_ALLOWED",
            "El pedido ya no permite esta acción.",
            status=409,
        )
    previous = order.status
    order.status = target
    now = timezone.now()
    update_fields = ["status", "updated_at"]
    if target == Order.Status.PURCHASE_VALIDATION:
        order.expiry_paused_at = now
        update_fields.append("expiry_paused_at")
    elif target == Order.Status.PAID:
        order.paid_at = now
        update_fields.append("paid_at")
    elif target == Order.Status.CANCELLED:
        order.cancelled_at = now
        update_fields.append("cancelled_at")
    elif target == Order.Status.EXPIRED:
        order.expired_at = now
        update_fields.append("expired_at")
    elif target == Order.Status.REFUNDED:
        order.refunded_at = now
        update_fields.append("refunded_at")
    if previous == Order.Status.CANCELLED:
        order.cancelled_at = None
        update_fields.append("cancelled_at")
    if target in EXPIRABLE_ORDER_STATUSES:
        order.expiry_paused_at = None
        update_fields.append("expiry_paused_at")
    order.save(update_fields=tuple(update_fields))
    if target == Order.Status.PAID:
        from apps.shipping.services import ensure_shipment_for_paid_order

        ensure_shipment_for_paid_order(
            order,
            actor=actor,
            correlation_id=correlation_id,
        )
    _append_event(
        order=order,
        event_type=event_type,
        title=title,
        detail=detail,
        actor=actor,
        from_status=previous,
        to_status=target,
        metadata=metadata,
        correlation_id=correlation_id,
    )
    _audit_order(
        order=order,
        action=f"sales.order_{target}",
        actor=actor,
        correlation_id=correlation_id,
        metadata={"fromStatus": previous, **dict(metadata or {})},
    )
    return True


def _buyer_email(order: Order) -> str:
    buyer = getattr(order, "buyer", None)
    return str(getattr(buyer, "email", "") or "")


def _order_notification_items(order: Order) -> list[dict[str, Any]]:
    return [
        {
            "productName": item.product_name,
            "quantity": item.quantity,
            "unitSalePrice": str(item.unit_sale_price),
            "lineTotal": str(item.line_total),
        }
        for item in order.items.all()
    ]


def _enqueue_order_notification(
    *,
    order: Order,
    template: str,
    deduplication_key: str,
    include_link: bool = False,
    parameters: Mapping[str, Any] | None = None,
) -> None:
    recipient = _buyer_email(order)
    if not recipient:
        return
    payload: dict[str, Any] = {
        "recipient": recipient,
        "template": template,
        "parameters": {
            "orderNumber": order.number,
            "status": order.status,
            **dict(parameters or {}),
        },
    }
    if include_link:
        payload["linkCiphertext"] = encrypt_outbox_value(public_order_url(order))
    enqueue_outbox_event(
        event_type="sales.order_notification",
        payload=payload,
        organisation=order.organisation,
        aggregate_type="sales.order",
        aggregate_public_id=str(order.public_id),
        deduplication_key=deduplication_key,
    )


def _active_reservations(order: Order) -> list[StockReservation]:
    return list(
        StockReservation.objects.select_for_update()
        .filter(
            order=order,
            consumed_at__isnull=True,
            released_at__isnull=True,
        )
        .select_related("product", "product__inventory")
        .order_by("product_id", "pk")
    )


def _release_order_reservations(
    order: Order,
    *,
    reason: str,
) -> bool:
    reservations = _active_reservations(order)
    if not reservations:
        return False
    context = _context_for_order(order)
    release_stock(
        context=context,
        requests=[
            StockRequest(product=reservation.product, quantity=reservation.quantity)
            for reservation in reservations
        ],
    )
    now = timezone.now()
    for reservation in reservations:
        reservation.released_at = now
        reservation.release_reason = reason[:120]
        reservation.save(update_fields=("released_at", "release_reason"))
    return True


def _consume_order_reservations(
    order: Order,
    *,
    actor: Any,
    correlation_id: str,
) -> bool:
    reservations = _active_reservations(order)
    if not reservations:
        return False
    context = TenantContext(
        user=actor or order.created_by,
        organisation=order.organisation,
        membership=_context_for_order(order).membership,
        inventory=order.inventory,
    )
    consumptions = consume_stock(
        context=context,
        requests=[
            StockRequest(product=reservation.product, quantity=reservation.quantity)
            for reservation in reservations
        ],
        reference_type="sales.order",
        reference_public_id=str(order.public_id),
        reason="Venta confirmada",
        correlation_id=correlation_id,
    )
    movements = {result.product.pk: result.movement for result in consumptions}
    now = timezone.now()
    for reservation in reservations:
        reservation.consumed_at = now
        reservation.stock_movement = movements[reservation.product_id]
        reservation.save(update_fields=("consumed_at", "stock_movement"))
    return True


def _mark_reconciliation_required(
    *,
    order: Order | None,
    payment: Payment | None,
    kind: str,
    summary: str,
    details: Mapping[str, Any] | None = None,
    webhook_event: Any = None,
    correlation_id: str = "",
) -> ReconciliationIssue:
    organisation = (
        order.organisation
        if order is not None
        else payment.organisation
        if payment is not None
        else getattr(webhook_event, "organisation", None)
    )
    issue_query = ReconciliationIssue.objects.filter(kind=kind)
    if webhook_event is not None:
        issue_query = issue_query.filter(webhook_event=webhook_event)
    else:
        issue_query = issue_query.filter(
            order=order,
            payment=payment,
            webhook_event__isnull=True,
            status__in={
                ReconciliationIssue.Status.OPEN,
                ReconciliationIssue.Status.RETRYING,
            },
        )
    issue = issue_query.first()
    created = issue is None
    if issue is None:
        issue = ReconciliationIssue.objects.create(
            organisation=organisation,
            order=order,
            payment=payment,
            webhook_event=webhook_event,
            kind=kind,
            summary=summary[:240],
            details=dict(details or {}),
        )
    elif issue.status == ReconciliationIssue.Status.RESOLVED:
        issue.status = ReconciliationIssue.Status.OPEN
        issue.summary = summary[:240]
        issue.details = dict(details or {})
        issue.resolved_at = None
        issue.save(
            update_fields=(
                "status",
                "summary",
                "details",
                "resolved_at",
                "updated_at",
            )
        )
        created = True
    if order is not None:
        status_changed = order.reconciliation_status != Order.ReconciliationStatus.REQUIRED
        if status_changed:
            order.reconciliation_status = Order.ReconciliationStatus.REQUIRED
            order.save(update_fields=("reconciliation_status", "updated_at"))
        if created or status_changed:
            _append_event(
                order=order,
                event_type="reconciliation.required",
                title="Venta requiere conciliación",
                detail=summary,
                metadata={"kind": kind, "issueId": str(issue.public_id)},
                correlation_id=correlation_id,
            )
            _audit_order(
                order=order,
                action="sales.order_reconciliation_required",
                correlation_id=correlation_id,
                metadata={"kind": kind, "issueId": str(issue.public_id)},
            )
    if payment is not None and not (
        kind == ReconciliationIssue.Kind.WEBHOOK_PENDING
        and payment.status in {Payment.Status.APPROVED, Payment.Status.REFUNDED}
    ):
        payment.status = Payment.Status.RECONCILIATION_REQUIRED
        payment.save(update_fields=("status", "updated_at"))
    return issue


def resolve_order_reconciliation_if_clear(
    order: Order,
    *,
    correlation_id: str = "",
) -> bool:
    if ReconciliationIssue.objects.filter(
        order=order,
        status__in={
            ReconciliationIssue.Status.OPEN,
            ReconciliationIssue.Status.RETRYING,
        },
    ).exists():
        return False
    if order.reconciliation_status == Order.ReconciliationStatus.OK:
        return False
    order.reconciliation_status = Order.ReconciliationStatus.OK
    order.save(update_fields=("reconciliation_status", "updated_at"))
    _append_event(
        order=order,
        event_type="reconciliation.resolved",
        title="Conciliación resuelta",
        correlation_id=correlation_id,
    )
    _audit_order(
        order=order,
        action="sales.order_reconciliation_resolved",
        correlation_id=correlation_id,
    )
    return True


def _normalise_lines(
    *,
    context: TenantContext,
    lines: Sequence[Mapping[str, Any]],
) -> tuple[list[dict[str, Any]], Decimal]:
    if not lines:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"lines": ["Agrega al menos un producto."]},
        )
    requested_ids: list[uuid.UUID] = []
    for index, line in enumerate(lines):
        try:
            requested_ids.append(uuid.UUID(str(line.get("product_id") or line.get("productId"))))
        except (TypeError, ValueError, AttributeError) as exc:
            raise DomainError(
                "VALIDATION_ERROR",
                "Revisa los datos ingresados.",
                field_errors={f"lines.{index}.productId": ["Selecciona un producto válido."]},
            ) from exc
    products = {
        product.public_id: product
        for product in Product.objects.filter(
            inventory=context.inventory,
            public_id__in=set(requested_ids),
        ).select_related("inventory", "inventory__organisation")
    }
    if set(requested_ids) != set(products):
        raise ResourceNotFound()

    cleaned: list[dict[str, Any]] = []
    total = Decimal("0")
    for index, (line, product_id) in enumerate(zip(lines, requested_ids, strict=True)):
        product = products[product_id]
        if product.catalog_status != Product.CatalogStatus.ACTIVE:
            raise DomainError(
                "PRODUCT_NOT_AVAILABLE",
                "Uno de los productos ya no está disponible.",
                field_errors={f"lines.{index}.productId": ["Selecciona un producto activo."]},
                status=409,
            )
        quantity = _clean_quantity(line.get("quantity"), index=index)
        price = clean_reference_price(
            line.get("unit_sale_price", line.get("unitSalePrice")),
            field=f"lines.{index}.unitSalePrice",
        )
        if price is None:
            raise DomainError(
                "VALIDATION_ERROR",
                "Revisa los datos ingresados.",
                field_errors={f"lines.{index}.unitSalePrice": ["Ingresa el precio efectivo."]},
            )
        line_total = price * quantity
        if line_total > MAX_ORDER_TOTAL or total + line_total > MAX_ORDER_TOTAL:
            raise DomainError(
                "VALIDATION_ERROR",
                "Revisa los datos ingresados.",
                field_errors={"lines": ["El total de la venta es demasiado alto."]},
            )
        total += line_total
        cleaned.append(
            {
                "product": product,
                "quantity": quantity,
                "unit_sale_price": price,
                "unit_cost_snapshot": product.purchase_price,
            }
        )
    return cleaned, total


@transaction.atomic
def _create_order(
    *,
    context: TenantContext,
    lines: Sequence[Mapping[str, Any]],
    delivery_mode: str,
    payment_method: str,
    correlation_id: str,
) -> Order:
    cleaned_lines, total = _normalise_lines(context=context, lines=lines)
    if delivery_mode not in {choice for choice, _label in Order.DeliveryMode.choices}:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"deliveryMode": ["Selecciona una modalidad de entrega válida."]},
        )
    if payment_method not in {choice for choice, _label in Order.PaymentMethod.choices}:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"paymentMethod": ["Selecciona un medio de pago válido."]},
        )
    if payment_method == Order.PaymentMethod.BANK_TRANSFER:
        from apps.organisations.bank import require_bank_details_for_deposit

        require_bank_details_for_deposit(context.organisation)
    if payment_method == Order.PaymentMethod.MERCADO_PAGO:
        connected = SellerPaymentConnection.objects.filter(
            organisation=context.organisation,
            provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
            status=SellerPaymentConnection.Status.CONNECTED,
        ).exists()
        if not connected:
            raise DomainError(
                "PAYMENT_CONNECTION_REQUIRED",
                "Conecta Mercado Pago antes de crear este cobro.",
                status=409,
            )

    public_id = uuid.uuid4()
    token = _new_public_token()
    now = timezone.now()
    expires_at = now + _reservation_ttl(organisation=context.organisation)
    order = Order.objects.create(
        public_id=public_id,
        organisation=context.organisation,
        inventory=context.inventory,
        number=f"VEN-{public_id.hex[:10].upper()}",
        status=Order.Status.RESERVED,
        delivery_mode=delivery_mode,
        payment_method=payment_method,
        total_amount=total,
        reservation_expires_at=expires_at,
        public_token_hash=_token_digest(token),
        public_token_ciphertext=encrypt_credential(token),
        public_token_expires_at=expires_at,
        created_by=context.user,
    )
    items = [
        OrderItem.objects.create(
            order=order,
            product=line["product"],
            line_number=index,
            product_name=line["product"].name,
            quantity=line["quantity"],
            unit_sale_price=line["unit_sale_price"],
            unit_cost_snapshot=line["unit_cost_snapshot"],
        )
        for index, line in enumerate(cleaned_lines, start=1)
    ]
    reserve_stock(
        context=context,
        requests=[StockRequest(product=item.product, quantity=item.quantity) for item in items],
    )
    StockReservation.objects.bulk_create(
        [
            StockReservation(
                order=order,
                order_item=item,
                inventory=context.inventory,
                product=item.product,
                quantity=item.quantity,
                expires_at=expires_at,
            )
            for item in items
        ]
    )
    _append_event(
        order=order,
        event_type="order.created",
        title="Venta creada y stock reservado",
        actor=context.user,
        from_status=Order.Status.DRAFT,
        to_status=Order.Status.RESERVED,
        metadata={"lineCount": len(items), "expiresAt": expires_at.isoformat()},
        correlation_id=correlation_id,
    )
    _audit_order(
        order=order,
        action="sales.order_created",
        actor=context.user,
        correlation_id=correlation_id,
        metadata={"lineCount": len(items), "total": str(total)},
    )
    return order


def create_order(
    *,
    context: TenantContext,
    lines: Sequence[Mapping[str, Any]],
    delivery_mode: str,
    payment_method: str,
    idempotency_key: str,
    correlation_id: str = "",
) -> OrderCommandResult:
    canonical_lines = [
        {
            "productId": str(line.get("product_id") or line.get("productId") or ""),
            "quantity": line.get("quantity"),
            "unitSalePrice": str(line.get("unit_sale_price", line.get("unitSalePrice", ""))),
        }
        for line in lines
    ]

    def command() -> tuple[dict[str, Any], int]:
        order = _create_order(
            context=context,
            lines=lines,
            delivery_mode=delivery_mode,
            payment_method=payment_method,
            correlation_id=correlation_id,
        )
        return {"orderId": str(order.public_id)}, 201

    outcome = execute_idempotent(
        context=context,
        scope="sales.create_order",
        key=idempotency_key,
        request_payload={
            "lines": canonical_lines,
            "deliveryMode": delivery_mode,
            "paymentMethod": payment_method,
        },
        command=command,
    )
    return OrderCommandResult(
        order=order_for_context(context, uuid.UUID(str(outcome.payload["orderId"]))),
        replayed=outcome.replayed,
    )


def publish_order_link(
    *,
    context: TenantContext,
    order_id: uuid.UUID,
    idempotency_key: str,
    correlation_id: str = "",
) -> OrderCommandResult:
    def command() -> tuple[dict[str, Any], int]:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(
                    organisation=context.organisation,
                    inventory=context.inventory,
                    public_id=order_id,
                )
                .first()
            )
            if order is None:
                raise ResourceNotFound()
            if order.status not in {
                Order.Status.RESERVED,
                Order.Status.PURCHASE_IN_PROGRESS,
                Order.Status.PURCHASE_VALIDATION,
            }:
                raise DomainError(
                    "ORDER_TRANSITION_NOT_ALLOWED",
                    "El pedido ya no permite publicar el enlace.",
                    status=409,
                )
            if order.published_at is None:
                order.published_at = timezone.now()
                order.save(update_fields=("published_at", "updated_at"))
                _append_event(
                    order=order,
                    event_type="order.link_published",
                    title="Enlace listo para compartir",
                    actor=context.user,
                    correlation_id=correlation_id,
                )
                _audit_order(
                    order=order,
                    action="sales.order_link_published",
                    actor=context.user,
                    correlation_id=correlation_id,
                )
        return {"orderId": str(order.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="sales.publish_order_link",
        key=idempotency_key,
        request_payload={"orderId": str(order_id)},
        command=command,
    )
    return OrderCommandResult(
        order=order_for_context(context, uuid.UUID(str(outcome.payload["orderId"]))),
        replayed=outcome.replayed,
    )


@transaction.atomic
def order_requires_delivery_details(order: Order) -> bool:
    return (
        order.delivery_mode == Order.DeliveryMode.SHIPPING
        or order.payment_method == Order.PaymentMethod.BANK_TRANSFER
    )


def buyer_has_required_delivery(buyer: BuyerSnapshot | None) -> bool:
    if buyer is None:
        return False
    return bool(
        (buyer.recipient_name or "").strip()
        and is_valid_rut(buyer.recipient_tax_id)
        and (buyer.phone or "").strip()
        and (buyer.address_line or "").strip()
        and is_valid_chile_location(buyer.region or "", buyer.commune or "")
    )


def set_buyer_details(
    *,
    token: str,
    details: Mapping[str, Any],
    correlation_id: str = "",
) -> Order:
    order = public_order_for_token(token)
    with transaction.atomic():
        return _set_buyer_details_locked(
            order=order,
            details=details,
            correlation_id=correlation_id,
        )


def _set_buyer_details_locked(
    *,
    order: Order,
    details: Mapping[str, Any],
    correlation_id: str,
) -> Order:
    order = (
        Order.objects.select_for_update()
        .select_related("organisation", "inventory")
        .get(pk=order.pk)
    )
    if order.status not in {
        Order.Status.RESERVED,
        Order.Status.PURCHASE_IN_PROGRESS,
    }:
        raise DomainError(
            "ORDER_TRANSITION_NOT_ALLOWED",
            "El pedido ya no permite editar los datos del comprador.",
            status=409,
        )
    _apply_buyer_snapshot(order, details)
    if order.status == Order.Status.RESERVED:
        _transition_order(
            order,
            Order.Status.PURCHASE_IN_PROGRESS,
            event_type="buyer.details_completed",
            title="Comprador completó sus datos",
            correlation_id=correlation_id,
        )
    else:
        _append_event(
            order=order,
            event_type="buyer.details_updated",
            title="Comprador actualizó sus datos",
            correlation_id=correlation_id,
        )
        _audit_order(
            order=order,
            action="sales.buyer_details_updated",
            correlation_id=correlation_id,
        )
    return _order_queryset().get(pk=order.pk)


def _apply_buyer_snapshot(order: Order, details: Mapping[str, Any]) -> BuyerSnapshot:
    name = _clean_required_text(
        details.get("name"),
        field="name",
        maximum=160,
        message="Ingresa el nombre.",
    )
    email = _clean_text(details.get("email"), maximum=254).lower()
    phone = _clean_text(details.get("phone"), maximum=32)
    if not email and not phone:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"email": ["Ingresa correo o teléfono."]},
        )
    if email:
        try:
            validate_email(email)
        except ValidationError as exc:
            raise DomainError(
                "VALIDATION_ERROR",
                "Revisa los datos ingresados.",
                field_errors={"email": ["Ingresa un correo válido."]},
            ) from exc
    address = _clean_text(details.get("address_line", details.get("addressLine")), maximum=240)
    recipient = _clean_text(
        details.get("recipient_name", details.get("recipientName")),
        maximum=160,
    )
    recipient_tax_id = _clean_text(
        details.get("recipient_tax_id", details.get("recipientTaxId")),
        maximum=16,
    )
    commune = _clean_text(details.get("commune"), maximum=120)
    region = _clean_text(details.get("region"), maximum=120)
    tax_commune = _clean_text(
        details.get("tax_commune", details.get("taxCommune")),
        maximum=120,
    )
    tax_region = _clean_text(
        details.get("tax_region", details.get("taxRegion")),
        maximum=120,
    )
    if order_requires_delivery_details(order):
        missing: dict[str, list[str]] = {}
        if not recipient:
            missing["recipientName"] = ["Ingresa quién recibe."]
        if not is_valid_rut(recipient_tax_id):
            missing["recipientTaxId"] = ["Ingresa el RUT de quien recibe."]
        else:
            recipient_tax_id = format_rut(recipient_tax_id)
        if not phone:
            missing["phone"] = ["Ingresa un teléfono de contacto."]
        if not address:
            missing["addressLine"] = ["Ingresa la dirección de despacho."]
        missing.update(_chile_location_errors(region, commune, required=True))
        if missing:
            raise DomainError(
                "VALIDATION_ERROR",
                "Completa los datos de despacho.",
                field_errors=missing,
            )
    else:
        location_errors = _chile_location_errors(region, commune, required=False)
        if location_errors:
            raise DomainError(
                "VALIDATION_ERROR",
                "Completa los datos de despacho.",
                field_errors=location_errors,
            )
    tax_errors = _chile_location_errors(
        tax_region,
        tax_commune,
        required=False,
        region_field="taxRegion",
        commune_field="taxCommune",
    )
    if tax_errors:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors=tax_errors,
        )
    snapshot, _created = BuyerSnapshot.objects.update_or_create(
        order=order,
        defaults={
            "name": name,
            "email": email,
            "phone": phone,
            "recipient_name": recipient,
            "recipient_tax_id": recipient_tax_id,
            "address_line": address,
            "commune": commune,
            "region": region,
            "delivery_notes": _clean_text(
                details.get("delivery_notes", details.get("deliveryNotes")),
                maximum=500,
            ),
            "tax_id": _clean_text(details.get("tax_id", details.get("taxId")), maximum=32),
            "tax_name": _clean_text(
                details.get("tax_name", details.get("taxName")),
                maximum=180,
            ),
            "tax_activity": _clean_text(
                details.get("tax_activity", details.get("taxActivity")),
                maximum=180,
            ),
            "tax_address": _clean_text(
                details.get("tax_address", details.get("taxAddress")),
                maximum=240,
            ),
            "tax_commune": tax_commune,
            "tax_region": tax_region,
            "tax_email": _clean_text(
                details.get("tax_email", details.get("taxEmail")),
                maximum=254,
            ).lower(),
            "completed_at": timezone.now(),
        },
    )
    return snapshot


def update_order_buyer(
    *,
    context: TenantContext,
    order_id: uuid.UUID,
    details: Mapping[str, Any],
    idempotency_key: str,
    correlation_id: str = "",
) -> OrderCommandResult:
    canonical = {
        "orderId": str(order_id),
        "name": details.get("name"),
        "email": details.get("email"),
        "phone": details.get("phone"),
        "recipientName": details.get("recipient_name", details.get("recipientName")),
        "recipientTaxId": details.get("recipient_tax_id", details.get("recipientTaxId")),
        "addressLine": details.get("address_line", details.get("addressLine")),
        "commune": details.get("commune"),
        "region": details.get("region"),
        "deliveryNotes": details.get("delivery_notes", details.get("deliveryNotes")),
    }

    def command() -> tuple[dict[str, Any], int]:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update(of=("self",))
                .select_related("organisation", "inventory")
                .filter(
                    organisation=context.organisation,
                    inventory=context.inventory,
                    public_id=order_id,
                )
                .first()
            )
            if order is None:
                raise ResourceNotFound()
            if order.status not in {
                Order.Status.RESERVED,
                Order.Status.PURCHASE_IN_PROGRESS,
                Order.Status.PURCHASE_VALIDATION,
                Order.Status.PAID,
            }:
                raise DomainError(
                    "ORDER_TRANSITION_NOT_ALLOWED",
                    "Esta venta ya no permite editar los datos del comprador.",
                    status=409,
                )
            _apply_buyer_snapshot(order, details)
            _append_event(
                order=order,
                event_type="buyer.details_updated",
                title="Vendedor corrigió los datos del comprador",
                correlation_id=correlation_id,
            )
            _audit_order(
                order=order,
                action="sales.buyer_details_updated_by_seller",
                correlation_id=correlation_id,
            )
            return {"orderId": str(order.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="sales.update_order_buyer",
        key=idempotency_key,
        request_payload=canonical,
        command=command,
    )
    return OrderCommandResult(
        order=order_for_context(context, uuid.UUID(str(outcome.payload["orderId"]))),
        replayed=outcome.replayed,
    )


def _connected_payment_connection(order: Order) -> SellerPaymentConnection:
    connection = SellerPaymentConnection.objects.filter(
        organisation=order.organisation,
        provider=SellerPaymentConnection.Provider.MERCADO_PAGO,
        status=SellerPaymentConnection.Status.CONNECTED,
    ).first()
    if connection is None or not connection.access_token_ciphertext:
        raise DomainError(
            "PAYMENT_CONNECTION_REQUIRED",
            "Mercado Pago no está disponible para este vendedor.",
            status=409,
        )
    return connection


def initiate_mercado_pago_checkout(
    *,
    token: str,
    idempotency_key: str,
    correlation_id: str = "",
) -> CheckoutResult:
    public_order = public_order_for_token(token)
    context = _context_for_order(public_order)

    def command() -> tuple[dict[str, Any], int]:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update(of=("self",))
                .select_related("organisation", "inventory", "buyer")
                .get(pk=public_order.pk)
            )
            if order.payment_method != Order.PaymentMethod.MERCADO_PAGO:
                raise DomainError(
                    "PAYMENT_METHOD_NOT_ALLOWED",
                    "Este pedido no usa Mercado Pago.",
                    status=409,
                )
            if order.status not in {
                Order.Status.RESERVED,
                Order.Status.PURCHASE_IN_PROGRESS,
            }:
                raise DomainError(
                    "ORDER_TRANSITION_NOT_ALLOWED",
                    "El pedido ya no permite iniciar el pago.",
                    status=409,
                )
            buyer = getattr(order, "buyer", None)
            if buyer is None or not buyer.email:
                raise DomainError(
                    "BUYER_DETAILS_REQUIRED",
                    "Completa los datos del comprador antes de pagar.",
                    status=409,
                )
            connection = _connected_payment_connection(order)
            access_token = decrypt_credential(connection.access_token_ciphertext)
            external_reference = f"order:{order.public_id}"
            payment, _created = Payment.objects.select_for_update().get_or_create(
                order=order,
                defaults={
                    "organisation": order.organisation,
                    "method": order.payment_method,
                    "amount": order.total_amount,
                    "provider": "mercado_pago",
                    "provider_account_id": connection.provider_account_id,
                    "external_reference": external_reference,
                    "fee_requested": Decimal("0"),
                },
            )
            if not payment.checkout_url or not payment.provider_preference_id:
                callback = f"{_public_origin()}/p/{token}"
                preference = get_payment_provider().create_preference(
                    PaymentPreferenceInput(
                        external_reference=external_reference,
                        title=f"Pedido {order.number}",
                        amount=order.total_amount,
                        currency=order.currency,
                        payer_email=buyer.email,
                        success_url=f"{callback}?payment=return",
                        pending_url=f"{callback}?payment=pending",
                        failure_url=f"{callback}?payment=failure",
                        notification_url=str(
                            getattr(
                                settings,
                                "MERCADO_PAGO_WEBHOOK_URL",
                                f"{_public_origin()}/api/v1/webhooks/mercado-pago",
                            )
                        ),
                    ),
                    idempotency_key=idempotency_key,
                    access_token=access_token,
                    marketplace_fee=Decimal("0"),
                )
                payment.provider_preference_id = preference.provider_id
                payment.checkout_url = preference.checkout_url
                payment.external_reference = external_reference
                payment.provider_account_id = connection.provider_account_id
                payment.fee_requested = Decimal("0")
                payment.save(
                    update_fields=(
                        "provider_preference_id",
                        "checkout_url",
                        "external_reference",
                        "provider_account_id",
                        "fee_requested",
                        "updated_at",
                    )
                )
            if order.status == Order.Status.RESERVED:
                _transition_order(
                    order,
                    Order.Status.PURCHASE_IN_PROGRESS,
                    event_type="payment.checkout_started",
                    title="Comprador inició Mercado Pago",
                    correlation_id=correlation_id,
                )
            else:
                _append_event(
                    order=order,
                    event_type="payment.checkout_started",
                    title="Comprador volvió a Mercado Pago",
                    correlation_id=correlation_id,
                )
                _audit_order(
                    order=order,
                    action="sales.payment_checkout_started",
                    correlation_id=correlation_id,
                )
        return {"orderId": str(order.public_id), "paymentId": str(payment.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="sales.initiate_mercado_pago_checkout",
        key=idempotency_key,
        request_payload={"orderId": str(public_order.public_id)},
        command=command,
    )
    order = order_for_context(context, uuid.UUID(str(outcome.payload["orderId"])))
    payment = Payment.objects.get(
        order=order,
        public_id=uuid.UUID(str(outcome.payload["paymentId"])),
    )
    return CheckoutResult(
        order=order,
        payment=payment,
        checkout_url=payment.checkout_url,
        replayed=outcome.replayed,
    )


def _get_or_create_manual_payment(order: Order) -> Payment:
    payment, _created = Payment.objects.select_for_update().get_or_create(
        order=order,
        defaults={
            "organisation": order.organisation,
            "method": order.payment_method,
            "amount": order.total_amount,
        },
    )
    return payment


def _approve_payment(
    *,
    order: Order,
    payment: Payment,
    actor: Any,
    paid_at: datetime,
    note: str,
    correlation_id: str,
    webhook_event: Any = None,
) -> bool:
    if order.status == Order.Status.PAID and payment.status == Payment.Status.APPROVED:
        return True
    if order.status not in ACTIVE_ORDER_STATUSES:
        raise DomainError(
            "ORDER_TRANSITION_NOT_ALLOWED",
            "El pedido ya no permite confirmar el pago.",
            status=409,
        )
    try:
        consumed = _consume_order_reservations(
            order,
            actor=actor,
            correlation_id=correlation_id,
        )
    except DomainError as exc:
        if exc.code != "STOCK_RECONCILIATION_REQUIRED":
            raise
        consumed = False
    if not consumed:
        _mark_reconciliation_required(
            order=order,
            payment=payment,
            kind=ReconciliationIssue.Kind.PAID_WITHOUT_STOCK,
            summary="El pago fue aprobado pero la reserva no estaba activa.",
            webhook_event=webhook_event,
            correlation_id=correlation_id,
        )
        return False
    payment.status = Payment.Status.APPROVED
    payment.paid_at = paid_at
    payment.manual_note = note[:500]
    payment.save(update_fields=("status", "paid_at", "manual_note", "updated_at"))
    _transition_order(
        order,
        Order.Status.PAID,
        event_type="payment.approved",
        title="Pago confirmado y stock descontado",
        actor=actor,
        correlation_id=correlation_id,
    )
    if order.paid_at != paid_at:
        order.paid_at = paid_at
        order.save(update_fields=("paid_at", "updated_at"))
    _enqueue_order_notification(
        order=order,
        template="order_paid",
        deduplication_key=f"sales:paid:{order.public_id}",
        include_link=True,
    )
    return True


def review_payment_proof(
    *,
    context: TenantContext,
    order_id: uuid.UUID,
    approved: bool,
    rejection_reason: str,
    idempotency_key: str,
    correlation_id: str = "",
) -> OrderCommandResult:
    clean_reason = _clean_text(rejection_reason, maximum=500)
    if not approved and not clean_reason:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"rejectionReason": ["Explica por qué rechazas el comprobante."]},
        )

    def command() -> tuple[dict[str, Any], int]:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(
                    organisation=context.organisation,
                    inventory=context.inventory,
                    public_id=order_id,
                )
                .first()
            )
            if order is None:
                raise ResourceNotFound()
            payment = Payment.objects.select_for_update().filter(order=order).first()
            proof = (
                PaymentProof.objects.select_for_update()
                .select_related("asset")
                .filter(payment=payment)
                .first()
                if payment is not None
                else None
            )
            if payment is None or proof is None or proof.status == PaymentProof.Status.PENDING:
                raise DomainError(
                    "PAYMENT_PROOF_REQUIRED",
                    "No hay un comprobante listo para revisar.",
                    status=409,
                )
            if approved and order.status == Order.Status.PAID:
                return {"orderId": str(order.public_id)}, 200
            if not approved and order.status == Order.Status.CANCELLED:
                return {"orderId": str(order.public_id)}, 200
            if order.status != Order.Status.PURCHASE_VALIDATION:
                raise DomainError(
                    "ORDER_TRANSITION_NOT_ALLOWED",
                    "El comprobante ya no puede revisarse.",
                    status=409,
                )
            now = timezone.now()
            proof.reviewed_at = now
            proof.reviewed_by = context.user
            if approved:
                proof.status = PaymentProof.Status.APPROVED
                proof.rejection_reason = ""
                proof.save(
                    update_fields=(
                        "status",
                        "reviewed_at",
                        "reviewed_by",
                        "rejection_reason",
                        "updated_at",
                    )
                )
                approved_payment = _approve_payment(
                    order=order,
                    payment=payment,
                    actor=context.user,
                    paid_at=now,
                    note="Comprobante aprobado",
                    correlation_id=correlation_id,
                )
                if not approved_payment:
                    return {
                        "orderId": str(order.public_id),
                        "reconciliationRequired": True,
                    }, 409
            else:
                proof.status = PaymentProof.Status.REJECTED
                proof.rejection_reason = clean_reason
                proof.save(
                    update_fields=(
                        "status",
                        "reviewed_at",
                        "reviewed_by",
                        "rejection_reason",
                        "updated_at",
                    )
                )
                payment.status = Payment.Status.REJECTED
                payment.rejected_at = now
                payment.provider_status_detail = clean_reason
                payment.save(
                    update_fields=(
                        "status",
                        "rejected_at",
                        "provider_status_detail",
                        "updated_at",
                    )
                )
                _release_order_reservations(order, reason="Comprobante rechazado")
                _transition_order(
                    order,
                    Order.Status.CANCELLED,
                    event_type="payment.proof_rejected",
                    title="Comprobante rechazado",
                    detail=clean_reason,
                    actor=context.user,
                    correlation_id=correlation_id,
                )
                _enqueue_order_notification(
                    order=order,
                    template="payment_proof_rejected",
                    deduplication_key=f"sales:proof-rejected:{order.public_id}",
                    include_link=True,
                    parameters={"reason": clean_reason},
                )
        return {"orderId": str(order.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="sales.review_payment_proof",
        key=idempotency_key,
        request_payload={
            "orderId": str(order_id),
            "approved": approved,
            "rejectionReason": clean_reason,
        },
        command=command,
    )
    if outcome.payload.get("reconciliationRequired"):
        raise DomainError(
            "PAYMENT_RECONCILIATION_REQUIRED",
            "El pago requiere revisión antes de cerrar la venta.",
            status=409,
            retryable=True,
        )
    return OrderCommandResult(
        order=order_for_context(context, uuid.UUID(str(outcome.payload["orderId"]))),
        replayed=outcome.replayed,
    )


def confirm_manual_payment(
    *,
    context: TenantContext,
    order_id: uuid.UUID,
    amount: object,
    paid_at: datetime,
    note: str,
    idempotency_key: str,
    correlation_id: str = "",
) -> OrderCommandResult:
    clean_amount = clean_reference_price(amount, field="amount")
    if clean_amount is None:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"amount": ["Ingresa el monto pagado."]},
        )
    if timezone.is_naive(paid_at):
        paid_at = timezone.make_aware(paid_at)
    clean_note = _clean_text(note, maximum=500)

    def command() -> tuple[dict[str, Any], int]:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(
                    organisation=context.organisation,
                    inventory=context.inventory,
                    public_id=order_id,
                )
                .first()
            )
            if order is None:
                raise ResourceNotFound()
            payment = _get_or_create_manual_payment(order)
            if order.status == Order.Status.PAID and payment.status == Payment.Status.APPROVED:
                return {"orderId": str(order.public_id)}, 200
            if order.payment_method not in {
                Order.PaymentMethod.CASH,
                Order.PaymentMethod.BANK_TRANSFER,
            }:
                raise DomainError(
                    "PAYMENT_METHOD_NOT_ALLOWED",
                    "Este medio de pago no admite confirmación manual.",
                    status=409,
                )
            if (
                order.payment_method == Order.PaymentMethod.BANK_TRANSFER
                and order.status == Order.Status.PURCHASE_VALIDATION
            ):
                raise DomainError(
                    "PAYMENT_PROOF_REVIEW_REQUIRED",
                    "Aprueba o rechaza el comprobante cargado.",
                    status=409,
                )
            if clean_amount != order.total_amount:
                raise DomainError(
                    "PAYMENT_AMOUNT_MISMATCH",
                    "El monto pagado debe coincidir con el total del pedido.",
                    field_errors={"amount": [f"Total esperado: {order.total_amount}."]},
                    status=409,
                )
            payment.amount = clean_amount
            approved_payment = _approve_payment(
                order=order,
                payment=payment,
                actor=context.user,
                paid_at=paid_at,
                note=clean_note,
                correlation_id=correlation_id,
            )
            if not approved_payment:
                return {
                    "orderId": str(order.public_id),
                    "reconciliationRequired": True,
                }, 409
        return {"orderId": str(order.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="sales.confirm_manual_payment",
        key=idempotency_key,
        request_payload={
            "orderId": str(order_id),
            "amount": str(clean_amount),
            "paidAt": paid_at.isoformat(),
            "note": clean_note,
        },
        command=command,
    )
    if outcome.payload.get("reconciliationRequired"):
        raise DomainError(
            "PAYMENT_RECONCILIATION_REQUIRED",
            "El pago requiere revisión antes de cerrar la venta.",
            status=409,
            retryable=True,
        )
    return OrderCommandResult(
        order=order_for_context(context, uuid.UUID(str(outcome.payload["orderId"]))),
        replayed=outcome.replayed,
    )


def cancel_order(
    *,
    context: TenantContext,
    order_id: uuid.UUID,
    reason: str,
    idempotency_key: str,
    correlation_id: str = "",
) -> OrderCommandResult:
    clean_reason = _clean_required_text(
        reason,
        field="reason",
        maximum=500,
        message="Explica por qué cancelas la venta.",
    )

    def command() -> tuple[dict[str, Any], int]:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(
                    organisation=context.organisation,
                    inventory=context.inventory,
                    public_id=order_id,
                )
                .first()
            )
            if order is None:
                raise ResourceNotFound()
            if order.status == Order.Status.CANCELLED:
                return {"orderId": str(order.public_id)}, 200
            if order.status not in ACTIVE_ORDER_STATUSES:
                raise DomainError(
                    "ORDER_TRANSITION_NOT_ALLOWED",
                    "El pedido ya no se puede cancelar.",
                    status=409,
                )
            _release_order_reservations(order, reason=clean_reason)
            payment = Payment.objects.select_for_update().filter(order=order).first()
            if payment is not None and payment.status in {
                Payment.Status.PENDING,
                Payment.Status.VALIDATION,
            }:
                payment.status = Payment.Status.CANCELLED
                payment.save(update_fields=("status", "updated_at"))
            _transition_order(
                order,
                Order.Status.CANCELLED,
                event_type="order.cancelled",
                title="Venta cancelada",
                detail=clean_reason,
                actor=context.user,
                correlation_id=correlation_id,
            )
            _enqueue_order_notification(
                order=order,
                template="order_cancelled",
                deduplication_key=f"sales:cancelled:{order.public_id}",
                parameters={"reason": clean_reason},
            )
        return {"orderId": str(order.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="sales.cancel_order",
        key=idempotency_key,
        request_payload={"orderId": str(order_id), "reason": clean_reason},
        command=command,
    )
    return OrderCommandResult(
        order=order_for_context(context, uuid.UUID(str(outcome.payload["orderId"]))),
        replayed=outcome.replayed,
    )


def _restore_target_status(order: Order) -> str:
    event = (
        order.timeline.filter(event_type="order.cancelled")
        .order_by("-created_at")
        .first()
    )
    if event is None or event.from_status not in ACTIVE_ORDER_STATUSES:
        raise DomainError(
            "ORDER_TRANSITION_NOT_ALLOWED",
            "Esta venta no se puede restaurar.",
            status=409,
        )
    target = event.from_status
    if target != Order.Status.PURCHASE_VALIDATION:
        return target
    payment = Payment.objects.filter(order=order).first()
    proof = (
        PaymentProof.objects.filter(payment=payment).first()
        if payment is not None
        else None
    )
    if proof is not None and proof.status == PaymentProof.Status.READY:
        return Order.Status.PURCHASE_VALIDATION
    if BuyerSnapshot.objects.filter(order=order).exists():
        return Order.Status.PURCHASE_IN_PROGRESS
    return Order.Status.RESERVED


def _reopen_order_reservations(order: Order, expires_at: datetime) -> None:
    active = _active_reservations(order)
    if active:
        StockReservation.objects.filter(pk__in=[row.pk for row in active]).update(
            expires_at=expires_at
        )
        return
    reservations = list(
        StockReservation.objects.select_for_update()
        .filter(order=order, consumed_at__isnull=True, released_at__isnull=False)
        .select_related("product")
        .order_by("product_id", "pk")
    )
    items = list(order.items.select_related("product").all())
    if not reservations:
        if not items:
            return
        reserve_stock(
            context=_context_for_order(order),
            requests=[
                StockRequest(product=item.product, quantity=item.quantity)
                for item in items
            ],
        )
        StockReservation.objects.bulk_create(
            [
                StockReservation(
                    order=order,
                    order_item=item,
                    inventory=order.inventory,
                    product=item.product,
                    quantity=item.quantity,
                    expires_at=expires_at,
                )
                for item in items
            ]
        )
        return
    reserve_stock(
        context=_context_for_order(order),
        requests=[
            StockRequest(product=reservation.product, quantity=reservation.quantity)
            for reservation in reservations
        ],
    )
    for reservation in reservations:
        reservation.released_at = None
        reservation.release_reason = ""
        reservation.expires_at = expires_at
        reservation.save(update_fields=("released_at", "release_reason", "expires_at"))


def _restore_cancelled_payment(order: Order, target: str) -> None:
    payment = Payment.objects.select_for_update().filter(order=order).first()
    if payment is None or payment.status != Payment.Status.CANCELLED:
        return
    proof = PaymentProof.objects.filter(payment=payment).first()
    payment.status = (
        Payment.Status.VALIDATION
        if target == Order.Status.PURCHASE_VALIDATION
        and proof is not None
        and proof.status == PaymentProof.Status.READY
        else Payment.Status.PENDING
    )
    payment.save(update_fields=("status", "updated_at"))


def restore_order(
    *,
    context: TenantContext,
    order_id: uuid.UUID,
    idempotency_key: str,
    correlation_id: str = "",
) -> OrderCommandResult:
    def command() -> tuple[dict[str, Any], int]:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .prefetch_related("items__product", "timeline")
                .filter(
                    organisation=context.organisation,
                    inventory=context.inventory,
                    public_id=order_id,
                )
                .first()
            )
            if order is None:
                raise ResourceNotFound()
            if order.status in ACTIVE_ORDER_STATUSES:
                return {"orderId": str(order.public_id)}, 200
            if order.status != Order.Status.CANCELLED:
                raise DomainError(
                    "ORDER_TRANSITION_NOT_ALLOWED",
                    "Solo una venta cancelada se puede restaurar.",
                    status=409,
                )
            target = _restore_target_status(order)
            now = timezone.now()
            expires_at = now + _reservation_ttl(organisation=context.organisation)
            _reopen_order_reservations(order, expires_at)
            _restore_cancelled_payment(order, target)
            order.reservation_expires_at = expires_at
            order.public_token_expires_at = expires_at
            order.save(
                update_fields=(
                    "reservation_expires_at",
                    "public_token_expires_at",
                    "updated_at",
                )
            )
            _transition_order(
                order,
                target,
                event_type="order.restored",
                title="Venta restaurada",
                detail="Se volvió a reservar el stock y el enlace quedó activo.",
                actor=context.user,
                correlation_id=correlation_id,
            )
        return {"orderId": str(order.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="sales.restore_order",
        key=idempotency_key,
        request_payload={"orderId": str(order_id)},
        command=command,
    )
    return OrderCommandResult(
        order=order_for_context(context, uuid.UUID(str(outcome.payload["orderId"]))),
        replayed=outcome.replayed,
    )


def refund_payment(
    *,
    context: TenantContext,
    order_id: uuid.UUID,
    reason: str,
    idempotency_key: str,
    correlation_id: str = "",
) -> OrderCommandResult:
    clean_reason = _clean_required_text(
        reason,
        field="reason",
        maximum=500,
        message="Explica el motivo del reembolso.",
    )

    def command() -> tuple[dict[str, Any], int]:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .filter(
                    organisation=context.organisation,
                    inventory=context.inventory,
                    public_id=order_id,
                )
                .first()
            )
            if order is None:
                raise ResourceNotFound()
            payment = Payment.objects.select_for_update().filter(order=order).first()
            if order.status == Order.Status.REFUNDED:
                return {"orderId": str(order.public_id)}, 200
            if (
                order.status != Order.Status.PAID
                or payment is None
                or payment.status != Payment.Status.APPROVED
            ):
                raise DomainError(
                    "ORDER_TRANSITION_NOT_ALLOWED",
                    "Solo una venta pagada puede reembolsarse.",
                    status=409,
                )
            if payment.provider == "mercado_pago":
                if not payment.provider_payment_id:
                    _mark_reconciliation_required(
                        order=order,
                        payment=payment,
                        kind=ReconciliationIssue.Kind.UNKNOWN_PAYMENT,
                        summary="Falta el identificador del pago para reembolsar.",
                        correlation_id=correlation_id,
                    )
                    return {
                        "orderId": str(order.public_id),
                        "reconciliationRequired": True,
                    }, 409
                connection = _connected_payment_connection(order)
                get_payment_provider().refund_payment(
                    payment.provider_payment_id,
                    amount=payment.amount,
                    idempotency_key=idempotency_key,
                    access_token=decrypt_credential(connection.access_token_ciphertext),
                )
            now = timezone.now()
            payment.status = Payment.Status.REFUNDED
            payment.refunded_amount = payment.amount
            payment.refunded_at = now
            payment.manual_note = clean_reason
            payment.save(
                update_fields=(
                    "status",
                    "refunded_amount",
                    "refunded_at",
                    "manual_note",
                    "updated_at",
                )
            )
            _transition_order(
                order,
                Order.Status.REFUNDED,
                event_type="payment.refunded",
                title="Pago reembolsado",
                detail=clean_reason,
                actor=context.user,
                correlation_id=correlation_id,
            )
            _enqueue_order_notification(
                order=order,
                template="order_refunded",
                deduplication_key=f"sales:refunded:{order.public_id}",
                parameters={"amount": str(payment.amount)},
            )
        return {"orderId": str(order.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="sales.refund_payment",
        key=idempotency_key,
        request_payload={"orderId": str(order_id), "reason": clean_reason},
        command=command,
    )
    if outcome.payload.get("reconciliationRequired"):
        raise DomainError(
            "PAYMENT_RECONCILIATION_REQUIRED",
            "El pago requiere conciliación antes de reembolsar.",
            status=409,
        )
    return OrderCommandResult(
        order=order_for_context(context, uuid.UUID(str(outcome.payload["orderId"]))),
        replayed=outcome.replayed,
    )


def resend_order_link(
    *,
    context: TenantContext,
    order_id: uuid.UUID,
    idempotency_key: str,
    correlation_id: str = "",
) -> OrderCommandResult:
    def command() -> tuple[dict[str, Any], int]:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update(of=("self",))
                .select_related("buyer")
                .filter(
                    organisation=context.organisation,
                    inventory=context.inventory,
                    public_id=order_id,
                )
                .first()
            )
            if order is None:
                raise ResourceNotFound()
            if order.status not in ACTIVE_ORDER_STATUSES:
                raise DomainError(
                    "ORDER_TRANSITION_NOT_ALLOWED",
                    "El enlace de este pedido ya no se puede reenviar.",
                    status=409,
                )
            if not _buyer_email(order):
                raise DomainError(
                    "BUYER_EMAIL_REQUIRED",
                    "Agrega el correo del comprador antes de reenviar.",
                    status=409,
                )
            _enqueue_order_notification(
                order=order,
                template="order_link",
                deduplication_key=(
                    f"sales:order-link:{order.public_id}:{hashlib.sha256(idempotency_key.encode()).hexdigest()}"
                ),
                include_link=True,
            )
            _append_event(
                order=order,
                event_type="order.link_resent",
                title="Enlace reenviado",
                actor=context.user,
                correlation_id=correlation_id,
            )
            _audit_order(
                order=order,
                action="sales.order_link_resent",
                actor=context.user,
                correlation_id=correlation_id,
            )
        return {"orderId": str(order.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="sales.resend_order_link",
        key=idempotency_key,
        request_payload={"orderId": str(order_id)},
        command=command,
    )
    return OrderCommandResult(
        order=order_for_context(context, uuid.UUID(str(outcome.payload["orderId"]))),
        replayed=outcome.replayed,
    )


def send_offer_link(
    *,
    context: TenantContext,
    order_id: uuid.UUID,
    email: str,
    idempotency_key: str,
    correlation_id: str = "",
) -> OrderCommandResult:
    clean_email = _clean_required_text(
        email,
        field="email",
        maximum=254,
        message="Ingresa un correo válido.",
    ).lower()
    try:
        validate_email(clean_email)
    except ValidationError as exc:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"email": ["Ingresa un correo válido."]},
        ) from exc

    def command() -> tuple[dict[str, Any], int]:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update(of=("self",))
                .select_related("buyer")
                .prefetch_related("items")
                .filter(
                    organisation=context.organisation,
                    inventory=context.inventory,
                    public_id=order_id,
                )
                .first()
            )
            if order is None:
                raise ResourceNotFound()
            if order.status not in ACTIVE_ORDER_STATUSES:
                raise DomainError(
                    "ORDER_TRANSITION_NOT_ALLOWED",
                    "El enlace de este pedido ya no se puede enviar.",
                    status=409,
                )
            buyer, _created = BuyerSnapshot.objects.get_or_create(
                order=order,
                defaults={"name": "Comprador", "email": clean_email},
            )
            updates: list[str] = []
            if buyer.email != clean_email:
                buyer.email = clean_email
                updates.append("email")
            if not buyer.name.strip():
                buyer.name = "Comprador"
                updates.append("name")
            if updates:
                buyer.save(update_fields=(*updates, "updated_at"))
            order.buyer = buyer
            first_item = next(iter(order.items.all()), None)
            _enqueue_order_notification(
                order=order,
                template="product_offer_link",
                deduplication_key=(
                    "sales:product-offer:"
                    f"{order.public_id}:{hashlib.sha256(idempotency_key.encode()).hexdigest()}"
                ),
                include_link=True,
                parameters={
                    "productName": first_item.product_name if first_item else "",
                    "total": str(order.total_amount),
                    "expiresAt": order.reservation_expires_at.isoformat(),
                },
            )
            _append_event(
                order=order,
                event_type="order.offer_link_sent",
                title="Enlace enviado por correo",
                detail=clean_email,
                actor=context.user,
                correlation_id=correlation_id,
            )
            _audit_order(
                order=order,
                action="sales.offer_link_sent",
                actor=context.user,
                correlation_id=correlation_id,
                metadata={"email": clean_email},
            )
        return {"orderId": str(order.public_id)}, 200

    outcome = execute_idempotent(
        context=context,
        scope="sales.send_offer_link",
        key=idempotency_key,
        request_payload={"orderId": str(order_id), "email": clean_email},
        command=command,
    )
    return OrderCommandResult(
        order=order_for_context(context, uuid.UUID(str(outcome.payload["orderId"]))),
        replayed=outcome.replayed,
    )


def reissue_bank_transfer_offer(
    *,
    context: TenantContext,
    order_id: uuid.UUID,
    idempotency_key: str,
    correlation_id: str = "",
) -> OrderCommandResult:
    def command() -> tuple[dict[str, Any], int]:
        with transaction.atomic():
            order = (
                Order.objects.select_for_update()
                .prefetch_related("items__product")
                .filter(
                    organisation=context.organisation,
                    inventory=context.inventory,
                    public_id=order_id,
                )
                .first()
            )
            if order is None:
                raise ResourceNotFound()
            if order.payment_method != Order.PaymentMethod.BANK_TRANSFER:
                raise DomainError(
                    "PAYMENT_METHOD_NOT_ALLOWED",
                    "Solo una venta por transferencia puede reenviarse.",
                    status=409,
                )
            if order.status != Order.Status.PURCHASE_VALIDATION:
                raise DomainError(
                    "ORDER_TRANSITION_NOT_ALLOWED",
                    "Esta venta ya no permite enviar de nuevo la solicitud.",
                    status=409,
                )
            lines = [
                {
                    "product_id": str(item.product.public_id),
                    "quantity": item.quantity,
                    "unit_sale_price": item.unit_sale_price,
                }
                for item in order.items.all()
            ]
            _release_order_reservations(order, reason="Solicitud reenviada")
            payment = Payment.objects.select_for_update().filter(order=order).first()
            if payment is not None and payment.status in {
                Payment.Status.PENDING,
                Payment.Status.VALIDATION,
            }:
                payment.status = Payment.Status.CANCELLED
                payment.save(update_fields=("status", "updated_at"))
            proof = (
                PaymentProof.objects.select_for_update().filter(payment=payment).first()
                if payment is not None
                else None
            )
            if proof is not None and proof.status == PaymentProof.Status.READY:
                proof.status = PaymentProof.Status.REJECTED
                proof.rejection_reason = "Se envió una nueva solicitud de compra."
                proof.reviewed_at = timezone.now()
                proof.reviewed_by = context.user
                proof.save(
                    update_fields=(
                        "status",
                        "rejection_reason",
                        "reviewed_at",
                        "reviewed_by",
                        "updated_at",
                    )
                )
            _transition_order(
                order,
                Order.Status.CANCELLED,
                event_type="order.reissued",
                title="Solicitud reenviada",
                detail="Se canceló esta venta y se creó un enlace nuevo.",
                actor=context.user,
                correlation_id=correlation_id,
            )
            replacement = _create_order(
                context=context,
                lines=lines,
                delivery_mode=order.delivery_mode,
                payment_method=Order.PaymentMethod.BANK_TRANSFER,
                correlation_id=correlation_id,
            )
            replacement.published_at = timezone.now()
            replacement.save(update_fields=("published_at", "updated_at"))
            _append_event(
                order=replacement,
                event_type="order.link_published",
                title="Enlace publicado",
                actor=context.user,
                correlation_id=correlation_id,
            )
        return {"orderId": str(replacement.public_id)}, 201

    outcome = execute_idempotent(
        context=context,
        scope="sales.reissue_bank_transfer_offer",
        key=idempotency_key,
        request_payload={"orderId": str(order_id)},
        command=command,
    )
    return OrderCommandResult(
        order=order_for_context(context, uuid.UUID(str(outcome.payload["orderId"]))),
        replayed=outcome.replayed,
    )


@transaction.atomic
def expire_order(order_pk: int) -> bool:
    order = (
        Order.objects.select_for_update(of=("self",))
        .select_related("organisation", "inventory", "created_by", "buyer")
        .prefetch_related("items")
        .filter(pk=order_pk)
        .first()
    )
    if (
        order is None
        or order.status not in EXPIRABLE_ORDER_STATUSES
        or order.reservation_expires_at > timezone.now()
    ):
        return False
    _release_order_reservations(order, reason="Reserva expirada")
    payment = Payment.objects.select_for_update().filter(order=order).first()
    if payment is not None and payment.status == Payment.Status.PENDING:
        payment.status = Payment.Status.CANCELLED
        payment.save(update_fields=("status", "updated_at"))
    _transition_order(
        order,
        Order.Status.EXPIRED,
        event_type="order.expired",
        title="Reserva expirada",
    )
    _enqueue_order_notification(
        order=order,
        template="order_expired",
        deduplication_key=f"sales:expired:{order.public_id}",
        parameters={
            "total": str(order.total_amount),
            "items": _order_notification_items(order),
        },
    )
    return True


def expire_due_orders(*, limit: int = 100) -> int:
    order_ids = list(
        Order.objects.filter(
            status__in=EXPIRABLE_ORDER_STATUSES,
            reservation_expires_at__lte=timezone.now(),
        )
        .order_by("reservation_expires_at", "pk")
        .values_list("pk", flat=True)[: max(1, min(limit, 500))]
    )
    return sum(1 for order_id in order_ids if expire_order(order_id))


def apply_provider_snapshot(
    *,
    order: Order,
    payment: Payment,
    snapshot: PaymentSnapshot,
    webhook_event: Any,
    correlation_id: str = "",
) -> None:
    """Apply provider truth under caller-owned order/payment locks."""

    expected_reference = f"order:{order.public_id}"
    mismatches: dict[str, Any] = {}
    if snapshot.external_reference != expected_reference:
        mismatches["externalReference"] = {
            "expected": expected_reference,
            "reported": snapshot.external_reference,
        }
    if snapshot.amount != payment.amount:
        mismatches["amount"] = {
            "expected": str(payment.amount),
            "reported": str(snapshot.amount),
        }
    if snapshot.currency != payment.currency:
        mismatches["currency"] = {
            "expected": payment.currency,
            "reported": snapshot.currency,
        }
    if snapshot.fee_amount is not None and snapshot.fee_amount != payment.fee_requested:
        mismatches["fee"] = {
            "expected": str(payment.fee_requested),
            "reported": str(snapshot.fee_amount),
        }
    if mismatches:
        _mark_reconciliation_required(
            order=order,
            payment=payment,
            kind=(
                ReconciliationIssue.Kind.FEE_MISMATCH
                if set(mismatches) == {"fee"}
                else ReconciliationIssue.Kind.PAYMENT_MISMATCH
            ),
            summary="Mercado Pago informó datos distintos al pedido.",
            details=mismatches,
            webhook_event=webhook_event,
            correlation_id=correlation_id,
        )
        return

    payment.provider_payment_id = snapshot.provider_payment_id
    payment.provider_status = snapshot.status
    payment.provider_status_detail = snapshot.status_detail[:160]
    payment.fee_reported = snapshot.fee_amount
    payment.net_received = snapshot.net_received
    payment.save(
        update_fields=(
            "provider_payment_id",
            "provider_status",
            "provider_status_detail",
            "fee_reported",
            "net_received",
            "updated_at",
        )
    )
    status = snapshot.status.lower()
    if status == "approved":
        if order.status == Order.Status.PAID and payment.status == Payment.Status.APPROVED:
            return
        if order.status in {Order.Status.CANCELLED, Order.Status.EXPIRED}:
            _mark_reconciliation_required(
                order=order,
                payment=payment,
                kind=ReconciliationIssue.Kind.PAID_WITHOUT_STOCK,
                summary="Mercado Pago aprobó el pago después de liberarse la reserva.",
                details={"orderStatus": order.status},
                webhook_event=webhook_event,
                correlation_id=correlation_id,
            )
            return
        if order.status == Order.Status.REFUNDED:
            return
        _approve_payment(
            order=order,
            payment=payment,
            actor=None,
            paid_at=snapshot.approved_at or timezone.now(),
            note="Confirmado por Mercado Pago",
            correlation_id=correlation_id,
            webhook_event=webhook_event,
        )
        return
    if status in {"rejected", "cancelled"}:
        if order.status in {Order.Status.CANCELLED, Order.Status.EXPIRED}:
            return
        if order.status == Order.Status.PAID:
            _mark_reconciliation_required(
                order=order,
                payment=payment,
                kind=ReconciliationIssue.Kind.PROVIDER_STATUS,
                summary="Mercado Pago contradijo un pago ya confirmado.",
                details={"status": status, "statusDetail": snapshot.status_detail},
                webhook_event=webhook_event,
                correlation_id=correlation_id,
            )
            return
        if order.status == Order.Status.REFUNDED:
            return
        if order.status in ACTIVE_ORDER_STATUSES:
            _release_order_reservations(order, reason=f"Mercado Pago: {status}")
            payment.status = (
                Payment.Status.REJECTED if status == "rejected" else Payment.Status.CANCELLED
            )
            payment.rejected_at = timezone.now()
            payment.save(update_fields=("status", "rejected_at", "updated_at"))
            _transition_order(
                order,
                Order.Status.CANCELLED,
                event_type=f"payment.{status}",
                title="Pago rechazado por Mercado Pago",
                detail=snapshot.status_detail,
                correlation_id=correlation_id,
            )
        return
    if status in {"pending", "in_process", "in_mediation"}:
        if payment.status != Payment.Status.APPROVED:
            payment.status = Payment.Status.PENDING
            payment.save(update_fields=("status", "updated_at"))
        return
    if status in {"refunded", "charged_back"}:
        refunded = snapshot.refunded_amount or payment.amount
        payment.refunded_amount = min(refunded, payment.amount)
        payment.refunded_at = timezone.now()
        if payment.refunded_amount == payment.amount and order.status == Order.Status.PAID:
            payment.status = Payment.Status.REFUNDED
            payment.save(
                update_fields=(
                    "status",
                    "refunded_amount",
                    "refunded_at",
                    "updated_at",
                )
            )
            _transition_order(
                order,
                Order.Status.REFUNDED,
                event_type="payment.refunded",
                title="Mercado Pago informó un reembolso",
                correlation_id=correlation_id,
            )
        else:
            payment.save(update_fields=("refunded_amount", "refunded_at", "updated_at"))
            _mark_reconciliation_required(
                order=order,
                payment=payment,
                kind=ReconciliationIssue.Kind.PARTIAL_REFUND,
                summary="Mercado Pago informó un reembolso parcial.",
                details={
                    "refundedAmount": str(payment.refunded_amount),
                    "orderAmount": str(payment.amount),
                },
                webhook_event=webhook_event,
                correlation_id=correlation_id,
            )
        return
    _mark_reconciliation_required(
        order=order,
        payment=payment,
        kind=ReconciliationIssue.Kind.PROVIDER_STATUS,
        summary="Mercado Pago informó un estado desconocido.",
        details={"status": snapshot.status, "statusDetail": snapshot.status_detail},
        webhook_event=webhook_event,
        correlation_id=correlation_id,
    )


def mark_payment_proof_ready(
    *,
    order: Order,
    proof: PaymentProof,
    correlation_id: str = "",
) -> Order:
    """Called by the contextual upload lifecycle after storage verification."""

    with transaction.atomic():
        locked_order = Order.objects.select_for_update().get(pk=order.pk)
        payment = Payment.objects.select_for_update().get(pk=proof.payment_id)
        locked_proof = PaymentProof.objects.select_for_update().get(pk=proof.pk)
        if locked_proof.status == PaymentProof.Status.READY:
            return _order_queryset().get(pk=locked_order.pk)
        if locked_order.status not in {
            Order.Status.RESERVED,
            Order.Status.PURCHASE_IN_PROGRESS,
        }:
            raise DomainError(
                "ORDER_TRANSITION_NOT_ALLOWED",
                "El pedido ya no permite cargar un comprobante.",
                status=409,
            )
        locked_proof.status = PaymentProof.Status.READY
        locked_proof.uploaded_at = timezone.now()
        locked_proof.save(update_fields=("status", "uploaded_at", "updated_at"))
        payment.status = Payment.Status.VALIDATION
        payment.save(update_fields=("status", "updated_at"))
        _transition_order(
            locked_order,
            Order.Status.PURCHASE_VALIDATION,
            event_type="payment.proof_uploaded",
            title="Comprobante recibido para validación",
            correlation_id=correlation_id,
        )
        _enqueue_order_notification(
            order=locked_order,
            template="payment_proof_received",
            deduplication_key=f"sales:proof-received:{locked_order.public_id}",
        )
    return _order_queryset().get(pk=order.pk)
