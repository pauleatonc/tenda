"""Tenant-safe shipment lists, dashboard counts and seller allowed actions."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from django.db.models import Count, Q, QuerySet

from apps.organisations.selectors import TenantContext
from apps.sales.models import Order
from tenda.errors import DomainError, ResourceNotFound
from tenda.pagination import Page, paginate

from .models import Shipment

STATUS_LABELS: dict[str, str] = dict(Shipment.Status.choices)

REGISTRABLE_STATUSES = frozenset({Shipment.Status.PENDING})
SETTLED_STATUSES = frozenset({Shipment.Status.DISPATCHED, Shipment.Status.DELIVERED})


@dataclass(frozen=True, slots=True)
class ShippingDashboard:
    total: int
    pending: int
    dispatched: int
    delivered: int


@dataclass(frozen=True, slots=True)
class ShipmentListFilter:
    search: str = ""
    statuses: tuple[str, ...] = ()
    delivery_mode: str = ""


def shipments_for_context(context: TenantContext) -> QuerySet[Shipment]:
    return Shipment.objects.filter(
        organisation=context.organisation,
        inventory=context.inventory,
    ).select_related("order", "order__buyer")


def shipment_for_context(context: TenantContext, shipment_id: uuid.UUID) -> Shipment:
    shipment = (
        shipments_for_context(context)
        .prefetch_related("labels", "labels__asset", "order__items")
        .filter(public_id=shipment_id)
        .first()
    )
    if shipment is None:
        raise ResourceNotFound()
    return shipment


def shipment_label_field_errors(shipment: Shipment) -> dict[str, list[str]]:
    errors: dict[str, list[str]] = {}
    if not shipment.recipient_name.strip():
        errors["recipientName"] = ["Completa el destinatario antes de generar la etiqueta."]
    if shipment.delivery_mode == Order.DeliveryMode.SHIPPING:
        if not shipment.address_line.strip():
            errors["addressLine"] = ["Completa la dirección de destino."]
        if not shipment.region.strip():
            errors["region"] = ["Completa la región de destino."]
        if not shipment.commune.strip():
            errors["commune"] = ["Completa la comuna de destino."]
    return errors


def order_is_paid(order: Order) -> bool:
    return order.status == Order.Status.PAID and order.paid_at is not None


def shipment_can_generate_label(shipment: Shipment) -> bool:
    if not order_is_paid(shipment.order):
        return False
    return not shipment_label_field_errors(shipment)


def shipment_can_register_dispatch(shipment: Shipment) -> bool:
    return shipment.status in REGISTRABLE_STATUSES and order_is_paid(shipment.order)


def buyer_email_for(shipment: Shipment) -> str:
    buyer = getattr(shipment.order, "buyer", None)
    return str(getattr(buyer, "email", "") or "")


def seller_allowed_actions(shipment: Shipment) -> tuple[str, ...]:
    actions: list[str] = []
    if shipment_can_register_dispatch(shipment):
        actions.append("registerShipmentDispatch")
    if shipment_can_generate_label(shipment):
        actions.append("generateShipmentLabel")
    return tuple(actions)


def shipping_dashboard(context: TenantContext) -> ShippingDashboard:
    counts = Shipment.objects.filter(
        organisation=context.organisation,
        inventory=context.inventory,
    ).aggregate(
        total=Count("id"),
        pending=Count("id", filter=Q(status=Shipment.Status.PENDING)),
        dispatched=Count("id", filter=Q(status=Shipment.Status.DISPATCHED)),
        delivered=Count("id", filter=Q(status=Shipment.Status.DELIVERED)),
    )
    return ShippingDashboard(
        total=int(counts["total"] or 0),
        pending=int(counts["pending"] or 0),
        dispatched=int(counts["dispatched"] or 0),
        delivered=int(counts["delivered"] or 0),
    )


def paginated_shipments(
    context: TenantContext,
    *,
    filters: ShipmentListFilter | None = None,
    first: int | None = None,
    after: str | None = None,
) -> Page[Shipment]:
    queryset = shipments_for_context(context)
    list_filter = filters or ShipmentListFilter()
    valid_statuses = {value for value, _label in Shipment.Status.choices}
    selected = tuple(dict.fromkeys(list_filter.statuses))
    if any(item not in valid_statuses for item in selected):
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los filtros.",
            field_errors={"status": ["Selecciona un estado válido."]},
        )
    if selected:
        queryset = queryset.filter(status__in=selected)
    if list_filter.delivery_mode:
        valid_modes = {value for value, _label in Order.DeliveryMode.choices}
        if list_filter.delivery_mode not in valid_modes:
            raise DomainError(
                "VALIDATION_ERROR",
                "Revisa los filtros.",
                field_errors={"deliveryMode": ["Selecciona una modalidad válida."]},
            )
        queryset = queryset.filter(delivery_mode=list_filter.delivery_mode)
    search = list_filter.search.strip()
    if search:
        queryset = queryset.filter(
            Q(number__icontains=search)
            | Q(recipient_name__icontains=search)
            | Q(tracking_code__icontains=search)
            | Q(carrier__icontains=search)
            | Q(order__number__icontains=search)
        )
    return paginate(
        queryset.prefetch_related("labels", "labels__asset"),
        cursor_field="created_at",
        after=after,
        first=first,
        descending=True,
    )
