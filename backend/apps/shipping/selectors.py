"""Tenant-safe shipment lists, dashboard counts and seller next actions."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from django.db.models import Count, Prefetch, Q, QuerySet

from apps.organisations.selectors import TenantContext
from apps.sales.models import Order
from tenda.errors import DomainError, ResourceNotFound
from tenda.pagination import Page, paginate

from .models import (
    DeliveryConfirmation,
    FollowUpSchedule,
    ReturnCase,
    Shipment,
    ShipmentEvent,
    Ticket,
)

STATUS_LABELS: dict[str, str] = dict(Shipment.Status.choices)

EDITABLE_STATUSES = frozenset({Shipment.Status.PENDING, Shipment.Status.PREPARING})
DISPATCHABLE_STATUSES = frozenset({Shipment.Status.PENDING, Shipment.Status.PREPARING})
ATTENTION_STATUSES = frozenset(
    {
        Shipment.Status.PENDING,
        Shipment.Status.PREPARING,
        Shipment.Status.DELIVERY_CHECK,
        Shipment.Status.ISSUE,
    }
)

SETTLED_STATUSES = frozenset(
    {
        Shipment.Status.DELIVERED,
        Shipment.Status.CLOSED,
        Shipment.Status.RETURNED,
        Shipment.Status.CANCELLED,
    }
)
RETURNABLE_STATUSES = frozenset(
    {
        Shipment.Status.DISPATCHED,
        Shipment.Status.DELIVERY_CHECK,
        Shipment.Status.DELIVERED,
        Shipment.Status.ISSUE,
    }
)
CONFIRMABLE_STATUSES = frozenset({Shipment.Status.DISPATCHED, Shipment.Status.DELIVERY_CHECK})
OPEN_TICKET_STATUSES = frozenset(
    {
        Ticket.Status.OPEN,
        Ticket.Status.AWAITING_SELLER,
        Ticket.Status.AWAITING_BUYER,
    }
)
TICKET_STATUS_LABELS: dict[str, str] = dict(Ticket.Status.choices)
TICKET_CATEGORY_LABELS: dict[str, str] = dict(Ticket.Category.choices)
FOLLOW_UP_KIND_LABELS: dict[str, str] = dict(FollowUpSchedule.Kind.choices)
FOLLOW_UP_STATUS_LABELS: dict[str, str] = dict(FollowUpSchedule.Status.choices)
RETURN_KIND_LABELS: dict[str, str] = dict(ReturnCase.Kind.choices)
PUBLIC_STATUS_LABELS: dict[str, str] = {
    "preparing": "Preparando",
    "dispatched": "Despachado",
    "received": "Recibido",
    "needs_help": "Hay una consulta",
    "cancelled": "Cancelado",
}
PUBLIC_EVENT_TITLES: dict[str, str] = {
    "shipment.created": "Pedido en preparación",
    "shipment.pending": "Pedido en preparación",
    "shipment.preparing": "Pedido en preparación",
    "shipment.dispatched": "Pedido despachado",
    "shipment.delivery_check": "Pedido despachado",
    "shipment.delivered": "Pedido recibido",
    "shipment.closed": "Pedido recibido",
    "shipment.issue": "Hay una consulta",
    "shipment.returned": "Hay una consulta",
    "shipment.cancelled": "El envío no continúa",
    "shipment.updated": "Datos de seguimiento actualizados",
    "shipment.buyer_needs_help": "Indicaste que necesitas ayuda",
}

NEXT_ACTIONS: dict[str, str] = {
    Shipment.Status.PENDING: "prepare",
    Shipment.Status.PREPARING: "dispatch",
    Shipment.Status.DISPATCHED: "check_delivery",
    Shipment.Status.DELIVERY_CHECK: "confirm_delivery",
    Shipment.Status.ISSUE: "review_issue",
    Shipment.Status.DELIVERED: "close",
    Shipment.Status.RETURNED: "close",
    Shipment.Status.CANCELLED: "close",
    Shipment.Status.CLOSED: "none",
}


@dataclass(frozen=True, slots=True)
class ShippingDashboard:
    total: int
    pending: int
    preparing: int
    dispatched: int
    delivery_check: int
    issue: int
    attention: int


@dataclass(frozen=True, slots=True)
class ShipmentListFilter:
    search: str = ""
    statuses: tuple[str, ...] = ()
    attention: bool | None = None
    delivery_mode: str = ""


def _ticket_queryset() -> QuerySet[Ticket]:
    return Ticket.objects.prefetch_related("messages", "messages__actor")


def _follow_up_queryset() -> QuerySet[FollowUpSchedule]:
    return FollowUpSchedule.objects.select_related("organisation").order_by("due_at", "id")


def _return_case_queryset() -> QuerySet[ReturnCase]:
    return ReturnCase.objects.order_by("-created_at", "-id")


def shipments_for_context(context: TenantContext) -> QuerySet[Shipment]:
    return Shipment.objects.filter(
        organisation=context.organisation,
        inventory=context.inventory,
    ).select_related("order", "order__buyer")


def shipment_for_context(context: TenantContext, shipment_id: uuid.UUID) -> Shipment:
    shipment = (
        shipments_for_context(context)
        .select_related("delivery_confirmation")
        .prefetch_related(
            "timeline",
            "timeline__actor",
            "labels",
            "labels__asset",
            Prefetch("tickets", queryset=_ticket_queryset()),
            Prefetch("follow_ups", queryset=_follow_up_queryset()),
            Prefetch("return_cases", queryset=_return_case_queryset()),
        )
        .filter(public_id=shipment_id)
        .first()
    )
    if shipment is None:
        raise ResourceNotFound()
    return shipment


def active_ticket(shipment: Shipment) -> Ticket | None:
    prefetched = getattr(shipment, "_prefetched_objects_cache", {}).get("tickets")
    if prefetched is not None:
        return next((item for item in prefetched if item.status in OPEN_TICKET_STATUSES), None)
    return shipment.tickets.filter(status__in=OPEN_TICKET_STATUSES).order_by("created_at").first()


def public_ticket_for(shipment: Shipment) -> Ticket | None:
    current = active_ticket(shipment)
    if current is not None:
        return current
    prefetched = getattr(shipment, "_prefetched_objects_cache", {}).get("tickets")
    if prefetched is not None:
        return prefetched[0] if prefetched else None
    return shipment.tickets.order_by("-created_at").first()


def ticket_for_context(context: TenantContext, ticket_id: uuid.UUID) -> Ticket:
    ticket = (
        _ticket_queryset()
        .select_related(
            "shipment",
            "shipment__order",
            "shipment__order__buyer",
            "organisation",
            "inventory",
        )
        .filter(
            public_id=ticket_id,
            organisation=context.organisation,
            inventory=context.inventory,
        )
        .first()
    )
    if ticket is None:
        raise ResourceNotFound()
    return ticket


def seller_next_action(shipment: Shipment) -> str:
    ticket = active_ticket(shipment)
    if ticket is not None and ticket.status in {
        Ticket.Status.OPEN,
        Ticket.Status.AWAITING_SELLER,
    }:
        return "reply_ticket"
    return NEXT_ACTIONS.get(shipment.status, "none")


def shipment_confirmation(shipment: Shipment) -> DeliveryConfirmation | None:
    try:
        return shipment.delivery_confirmation
    except DeliveryConfirmation.DoesNotExist:
        return None


def public_status_for(shipment: Shipment) -> str:
    if shipment.status == Shipment.Status.CANCELLED:
        return "cancelled"
    if active_ticket(shipment) is not None:
        return "needs_help"
    confirmation = shipment_confirmation(shipment)
    if (
        confirmation is not None
        and confirmation.outcome == DeliveryConfirmation.Outcome.NEEDS_HELP
        and shipment.status not in {Shipment.Status.DELIVERED, Shipment.Status.CLOSED}
    ):
        return "needs_help"
    if shipment.status in {Shipment.Status.PENDING, Shipment.Status.PREPARING}:
        return "preparing"
    if shipment.status in {Shipment.Status.DISPATCHED, Shipment.Status.DELIVERY_CHECK}:
        return "dispatched"
    if shipment.status in {Shipment.Status.DELIVERED, Shipment.Status.CLOSED}:
        return "received"
    if shipment.status in {Shipment.Status.ISSUE, Shipment.Status.RETURNED}:
        return "needs_help"
    return "preparing"


def public_status_label(shipment: Shipment) -> str:
    status = public_status_for(shipment)
    return PUBLIC_STATUS_LABELS.get(status, status)


def public_timeline(shipment: Shipment) -> list[ShipmentEvent]:
    return [event for event in shipment.timeline.all() if event.is_public]


def public_event_title(event: ShipmentEvent) -> str:
    return PUBLIC_EVENT_TITLES.get(event.event_type, event.title)


def public_allowed_actions(shipment: Shipment) -> tuple[str, ...]:
    actions: list[str] = []
    confirmation = shipment_confirmation(shipment)
    if confirmation is None and shipment.status in CONFIRMABLE_STATUSES:
        actions.extend(("confirmReceived", "requestHelp"))
    ticket = active_ticket(shipment)
    if ticket is None:
        if shipment.status != Shipment.Status.CANCELLED:
            actions.append("openPublicTicket")
    else:
        actions.append("sendTicketMessage")
    return tuple(actions)


def public_can_confirm(shipment: Shipment) -> bool:
    return "confirmReceived" in public_allowed_actions(shipment)


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


def shipment_can_generate_label(shipment: Shipment) -> bool:
    order = shipment.order
    if order.status != Order.Status.PAID or order.paid_at is None:
        return False
    return not shipment_label_field_errors(shipment)


def follow_ups_for(shipment: Shipment) -> list[FollowUpSchedule]:
    prefetched = getattr(shipment, "_prefetched_objects_cache", {}).get("follow_ups")
    if prefetched is not None:
        return list(prefetched)
    return list(shipment.follow_ups.all())


def next_follow_up(shipment: Shipment) -> FollowUpSchedule | None:
    scheduled = [
        item
        for item in follow_ups_for(shipment)
        if item.status == FollowUpSchedule.Status.SCHEDULED
    ]
    scheduled.sort(key=lambda item: (item.due_at, item.pk))
    return scheduled[0] if scheduled else None


def return_cases_for(shipment: Shipment) -> list[ReturnCase]:
    prefetched = getattr(shipment, "_prefetched_objects_cache", {}).get("return_cases")
    if prefetched is not None:
        return list(prefetched)
    return list(shipment.return_cases.all())


def seller_allowed_actions(shipment: Shipment) -> tuple[str, ...]:
    actions: list[str] = []
    if shipment.status in EDITABLE_STATUSES:
        actions.append("updateShipment")
    if shipment.status in DISPATCHABLE_STATUSES:
        actions.append("markShipmentDispatched")
    if shipment_can_generate_label(shipment):
        actions.append("generateShipmentLabel")
    if active_ticket(shipment) is not None:
        actions.extend(("sendTicketMessage", "resolveTicket"))
    if next_follow_up(shipment) is not None:
        actions.append("rescheduleFollowUp")
    if shipment.status in RETURNABLE_STATUSES:
        actions.append("registerReturnCase")
    if any(case.stock_confirmed_at is None for case in return_cases_for(shipment)):
        actions.append("confirmReturnToStock")
    return tuple(actions)


def shipping_dashboard(context: TenantContext) -> ShippingDashboard:
    counts = Shipment.objects.filter(
        organisation=context.organisation,
        inventory=context.inventory,
    ).aggregate(
        total=Count("id"),
        pending=Count("id", filter=Q(status=Shipment.Status.PENDING)),
        preparing=Count("id", filter=Q(status=Shipment.Status.PREPARING)),
        dispatched=Count("id", filter=Q(status=Shipment.Status.DISPATCHED)),
        delivery_check=Count("id", filter=Q(status=Shipment.Status.DELIVERY_CHECK)),
        issue=Count("id", filter=Q(status=Shipment.Status.ISSUE)),
        attention=Count("id", filter=Q(status__in=ATTENTION_STATUSES)),
    )
    return ShippingDashboard(
        total=int(counts["total"] or 0),
        pending=int(counts["pending"] or 0),
        preparing=int(counts["preparing"] or 0),
        dispatched=int(counts["dispatched"] or 0),
        delivery_check=int(counts["delivery_check"] or 0),
        issue=int(counts["issue"] or 0),
        attention=int(counts["attention"] or 0),
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
    if list_filter.attention is True:
        queryset = queryset.filter(status__in=ATTENTION_STATUSES)
    elif list_filter.attention is False:
        queryset = queryset.exclude(status__in=ATTENTION_STATUSES)
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
        queryset.prefetch_related(
            "tickets",
            Prefetch("follow_ups", queryset=_follow_up_queryset()),
        ),
        cursor_field="created_at",
        after=after,
        first=first,
        descending=True,
    )


def shipment_timeline(
    context: TenantContext,
    shipment_id: uuid.UUID,
) -> list[ShipmentEvent]:
    shipment = shipment_for_context(context, shipment_id)
    return list(shipment.timeline.select_related("actor").all())
