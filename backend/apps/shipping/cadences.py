"""Durable follow-up cadences. due_at lives in PostgreSQL, never in Redis."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.audit.idempotency import execute_idempotent
from apps.audit.services import record_audit_event
from apps.configuration.models import OperationalParameter
from apps.configuration.services import parameter_value
from apps.notifications.outbox import enqueue_outbox_event
from apps.organisations.models import Membership, Organisation
from apps.organisations.selectors import TenantContext
from tenda.crypto import encrypt_outbox_value
from tenda.errors import DomainError, ResourceNotFound

from .models import FollowUpSchedule, Shipment, Ticket

DELIVERY_CHECK_KEY = "shipping.delivery_check_hours"
REMINDER_KEY = "shipping.awaiting_reminder_hours"
AUTOCLOSE_KEY = "shipping.autoclose_days"

KIND_PARAMETERS: dict[str, tuple[str, str, int]] = {
    FollowUpSchedule.Kind.DELIVERY_CHECK: (DELIVERY_CHECK_KEY, "hours", 72),
    FollowUpSchedule.Kind.REMINDER: (REMINDER_KEY, "hours", 48),
    FollowUpSchedule.Kind.AUTOCLOSE: (AUTOCLOSE_KEY, "days", 7),
}

SOURCE_LABELS: dict[str, str] = {
    "organisation": "Parámetro de la organización",
    "global": "Parámetro global",
    "default": "Valor por defecto",
}

TERMINAL_SHIPMENT_STATUSES = frozenset(
    {
        Shipment.Status.DELIVERED,
        Shipment.Status.RETURNED,
        Shipment.Status.CANCELLED,
        Shipment.Status.CLOSED,
    }
)
PROCESSABLE_STATUSES = frozenset(
    {
        FollowUpSchedule.Status.SCHEDULED,
        FollowUpSchedule.Status.DUE,
    }
)


@dataclass(frozen=True, slots=True)
class CadenceMeta:
    key: str
    source: str
    source_label: str
    display: str


@dataclass(frozen=True, slots=True)
class FollowUpCommandResult:
    follow_up: FollowUpSchedule
    replayed: bool


def _as_positive_int(value: object, default: int) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value if value > 0 else default
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        number = int(value)
        return number if number > 0 else default
    return default


def _clean_text(value: object, *, maximum: int) -> str:
    return " ".join(str(value or "").split())[:maximum]


def cadence_delta(kind: str, organisation: Organisation) -> timedelta:
    key, unit, default = KIND_PARAMETERS[kind]
    amount = _as_positive_int(
        parameter_value(key, organisation=organisation, default=default),
        default,
    )
    if unit == "days":
        return timedelta(days=amount)
    return timedelta(hours=amount)


def cadence_meta(kind: str, organisation: Organisation) -> CadenceMeta:
    key, unit, default = KIND_PARAMETERS[kind]
    amount = _as_positive_int(
        parameter_value(key, organisation=organisation, default=default),
        default,
    )
    queryset = OperationalParameter.objects.filter(key=key, is_active=True)
    if queryset.filter(organisation=organisation).exists():
        source = "organisation"
    elif queryset.filter(organisation__isnull=True).exists():
        source = "global"
    else:
        source = "default"
    suffix = "días" if unit == "days" and amount != 1 else "día" if unit == "days" else "h"
    if unit == "days":
        display = f"{amount} {suffix}"
    else:
        display = f"{amount} h"
    return CadenceMeta(
        key=key,
        source=source,
        source_label=SOURCE_LABELS[source],
        display=display,
    )


def organisation_contact_email(organisation: Organisation) -> str:
    if organisation.business_email:
        return organisation.business_email
    membership = (
        Membership.objects.filter(organisation=organisation)
        .select_related("user")
        .order_by("created_at")
        .first()
    )
    return membership.user.email if membership is not None else ""


def seller_shipment_url(shipment: Shipment) -> str:
    origin = str(getattr(settings, "WEB_ORIGIN", "")).rstrip("/")
    return f"{origin}/app/despachos/{shipment.public_id}"


def _scheduled_follow_ups(shipment: Shipment) -> QuerySet[FollowUpSchedule]:
    return FollowUpSchedule.objects.filter(
        shipment=shipment,
        status=FollowUpSchedule.Status.SCHEDULED,
    )


def cancel_follow_ups(
    shipment: Shipment,
    *,
    kinds: frozenset[str] | None = None,
    ticket: Ticket | None = None,
    exclude_id: int | None = None,
    statuses: frozenset[str] | None = None,
) -> None:
    queryset = FollowUpSchedule.objects.filter(
        shipment=shipment,
        status__in=statuses or {FollowUpSchedule.Status.SCHEDULED},
    )
    if kinds is not None:
        queryset = queryset.filter(kind__in=kinds)
    if ticket is not None:
        queryset = queryset.filter(ticket=ticket)
    if exclude_id is not None:
        queryset = queryset.exclude(pk=exclude_id)
    now = timezone.now()
    queryset.update(
        status=FollowUpSchedule.Status.CANCELLED,
        cancelled_at=now,
        updated_at=now,
    )


def schedule_follow_up(
    shipment: Shipment,
    kind: str,
    *,
    ticket: Ticket | None = None,
    due_at: datetime | None = None,
) -> FollowUpSchedule:
    cancel_follow_ups(
        shipment,
        kinds=frozenset({kind}),
        ticket=ticket,
    )
    return FollowUpSchedule.objects.create(
        organisation=shipment.organisation,
        shipment=shipment,
        ticket=ticket,
        kind=kind,
        status=FollowUpSchedule.Status.SCHEDULED,
        due_at=due_at or timezone.now() + cadence_delta(kind, shipment.organisation),
    )


def sync_shipment_cadences(shipment: Shipment) -> None:
    if shipment.status == Shipment.Status.DISPATCHED:
        if (
            not _scheduled_follow_ups(shipment)
            .filter(kind=FollowUpSchedule.Kind.DELIVERY_CHECK)
            .exists()
        ):
            schedule_follow_up(shipment, FollowUpSchedule.Kind.DELIVERY_CHECK)
        return
    if shipment.status in TERMINAL_SHIPMENT_STATUSES:
        cancel_follow_ups(shipment, statuses=PROCESSABLE_STATUSES)
        return
    if shipment.status in {Shipment.Status.DELIVERY_CHECK, Shipment.Status.ISSUE}:
        cancel_follow_ups(
            shipment,
            kinds=frozenset({FollowUpSchedule.Kind.DELIVERY_CHECK}),
        )


def sync_ticket_cadences(ticket: Ticket) -> None:
    shipment = ticket.shipment
    open_statuses = {
        Ticket.Status.OPEN,
        Ticket.Status.AWAITING_SELLER,
        Ticket.Status.AWAITING_BUYER,
    }
    if ticket.status == Ticket.Status.AWAITING_BUYER:
        schedule_follow_up(
            shipment,
            FollowUpSchedule.Kind.REMINDER,
            ticket=ticket,
        )
        return
    cancel_follow_ups(
        shipment,
        kinds=frozenset({FollowUpSchedule.Kind.REMINDER, FollowUpSchedule.Kind.AUTOCLOSE}),
        ticket=ticket,
    )
    if ticket.status not in open_statuses:
        return


def _mark_sent(follow_up: FollowUpSchedule) -> None:
    now = timezone.now()
    follow_up.status = FollowUpSchedule.Status.SENT
    follow_up.sent_at = now
    follow_up.save(update_fields=("status", "sent_at", "updated_at"))


def _mark_cancelled(follow_up: FollowUpSchedule) -> None:
    now = timezone.now()
    follow_up.status = FollowUpSchedule.Status.CANCELLED
    follow_up.cancelled_at = now
    follow_up.save(update_fields=("status", "cancelled_at", "updated_at"))


def _mark_due(follow_up: FollowUpSchedule) -> None:
    if follow_up.status == FollowUpSchedule.Status.DUE:
        return
    follow_up.status = FollowUpSchedule.Status.DUE
    follow_up.save(update_fields=("status", "updated_at"))


def _enqueue_seller_delivery_check(shipment: Shipment) -> None:
    recipient = organisation_contact_email(shipment.organisation)
    if not recipient:
        return
    enqueue_outbox_event(
        event_type="shipping.shipment_notification",
        payload={
            "recipient": recipient,
            "template": "shipment.delivery_check_seller",
            "linkCiphertext": encrypt_outbox_value(seller_shipment_url(shipment)),
            "linkParameter": "shipmentUrl",
            "parameters": {
                "shipmentNumber": shipment.number,
                "orderNumber": shipment.order.number,
            },
        },
        organisation=shipment.organisation,
        aggregate_type="shipping.shipment",
        aggregate_public_id=str(shipment.public_id),
        deduplication_key=f"shipping.shipment:{shipment.public_id}:delivery_check:seller",
    )


def _process_delivery_check(follow_up: FollowUpSchedule) -> None:
    from .services import _apply_status_change

    shipment = (
        Shipment.objects.select_for_update()
        .select_related("order", "organisation")
        .get(pk=follow_up.shipment_id)
    )
    if shipment.status != Shipment.Status.DISPATCHED:
        _mark_cancelled(follow_up)
        return
    _apply_status_change(
        shipment,
        target=Shipment.Status.DELIVERY_CHECK,
        comment="Chequeo de entrega programado.",
        actor=None,
        correlation_id="shipping.follow_up",
    )
    _enqueue_seller_delivery_check(shipment)
    _mark_sent(follow_up)


def _process_reminder(follow_up: FollowUpSchedule) -> None:
    from .tickets import (
        _enqueue_ticket_notification,
        public_ticket_url,
    )

    ticket = (
        Ticket.objects.select_for_update()
        .select_related("shipment", "shipment__order", "organisation")
        .filter(pk=follow_up.ticket_id)
        .first()
        if follow_up.ticket_id
        else None
    )
    if ticket is None or ticket.status != Ticket.Status.AWAITING_BUYER:
        _mark_cancelled(follow_up)
        return
    _enqueue_ticket_notification(
        ticket,
        template="ticket.reminder",
        recipient=ticket.contact_email,
        link=public_ticket_url(ticket),
        link_parameter="ticketUrl",
        deduplication_key=f"shipping.ticket:{ticket.public_id}:reminder",
    )
    _mark_sent(follow_up)
    schedule_follow_up(
        ticket.shipment,
        FollowUpSchedule.Kind.AUTOCLOSE,
        ticket=ticket,
    )


def _has_sent_reminder(ticket: Ticket) -> bool:
    return FollowUpSchedule.objects.filter(
        ticket=ticket,
        kind=FollowUpSchedule.Kind.REMINDER,
        status=FollowUpSchedule.Status.SENT,
    ).exists()


def _process_autoclose(follow_up: FollowUpSchedule) -> None:
    from .tickets import autoclose_ticket

    ticket = (
        Ticket.objects.select_for_update()
        .select_related("shipment", "shipment__order", "organisation", "inventory")
        .filter(pk=follow_up.ticket_id)
        .first()
        if follow_up.ticket_id
        else None
    )
    open_statuses = {
        Ticket.Status.OPEN,
        Ticket.Status.AWAITING_SELLER,
        Ticket.Status.AWAITING_BUYER,
    }
    if ticket is None or ticket.status not in open_statuses:
        _mark_cancelled(follow_up)
        return
    if not _has_sent_reminder(ticket):
        _mark_cancelled(follow_up)
        return
    autoclose_ticket(ticket, correlation_id="shipping.follow_up")
    _mark_sent(follow_up)
    cancel_follow_ups(
        ticket.shipment,
        kinds=frozenset({FollowUpSchedule.Kind.REMINDER, FollowUpSchedule.Kind.AUTOCLOSE}),
        ticket=ticket,
        exclude_id=follow_up.pk,
    )


def _process_one(follow_up: FollowUpSchedule) -> None:
    _mark_due(follow_up)
    if follow_up.kind == FollowUpSchedule.Kind.DELIVERY_CHECK:
        _process_delivery_check(follow_up)
    elif follow_up.kind == FollowUpSchedule.Kind.REMINDER:
        _process_reminder(follow_up)
    elif follow_up.kind == FollowUpSchedule.Kind.AUTOCLOSE:
        _process_autoclose(follow_up)
    else:
        _mark_cancelled(follow_up)


def process_due_follow_ups(*, limit: int = 100) -> int:
    follow_up_ids = list(
        FollowUpSchedule.objects.filter(
            status__in=PROCESSABLE_STATUSES,
            due_at__lte=timezone.now(),
        )
        .order_by("due_at", "pk")
        .values_list("pk", flat=True)[: max(1, min(limit, 500))]
    )
    processed = 0
    for follow_up_id in follow_up_ids:
        with transaction.atomic():
            follow_up = (
                FollowUpSchedule.objects.select_for_update()
                .select_related("shipment", "ticket")
                .filter(pk=follow_up_id)
                .first()
            )
            if follow_up is None or follow_up.status not in PROCESSABLE_STATUSES:
                continue
            _process_one(follow_up)
            processed += 1
    return processed


def load_follow_up(context: TenantContext, follow_up_id: Any) -> FollowUpSchedule:
    follow_up = (
        FollowUpSchedule.objects.select_related("shipment", "organisation", "ticket")
        .filter(
            public_id=follow_up_id,
            organisation=context.organisation,
            shipment__inventory=context.inventory,
        )
        .first()
    )
    if follow_up is None:
        raise ResourceNotFound()
    return follow_up


@transaction.atomic
def reschedule_follow_up(
    *,
    context: TenantContext,
    follow_up_id: Any,
    due_at: datetime,
    reason: str,
    idempotency_key: str,
    correlation_id: str = "",
) -> FollowUpCommandResult:
    note = _clean_text(reason, maximum=500)
    if len(note) < 8:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"reason": ["Explica el motivo de la reprogramación."]},
        )
    if timezone.is_naive(due_at):
        due_at = timezone.make_aware(due_at, timezone.get_current_timezone())

    def command() -> tuple[dict[str, Any], int]:
        follow_up = (
            FollowUpSchedule.objects.select_for_update()
            .select_related("shipment")
            .filter(
                public_id=follow_up_id,
                organisation=context.organisation,
                shipment__inventory=context.inventory,
            )
            .first()
        )
        if follow_up is None:
            raise ResourceNotFound()
        if follow_up.status != FollowUpSchedule.Status.SCHEDULED:
            raise DomainError(
                "FOLLOW_UP_NOT_SCHEDULABLE",
                "Esta cadencia ya no se puede reprogramar.",
                status=409,
            )
        previous = follow_up.due_at
        follow_up.due_at = due_at
        follow_up.save(update_fields=("due_at", "updated_at"))
        record_audit_event(
            action="shipping.follow_up_rescheduled",
            organisation=follow_up.organisation,
            actor=context.user,
            object_type="shipping.follow_up",
            object_public_id=str(follow_up.public_id),
            correlation_id=correlation_id,
            metadata={
                "reason": note,
                "kind": follow_up.kind,
                "fromDueAt": previous.isoformat(),
                "toDueAt": due_at.isoformat(),
                "shipmentId": str(follow_up.shipment.public_id),
            },
        )
        return {"followUpId": str(follow_up.public_id)}, 200

    stored = execute_idempotent(
        context=context,
        scope="shipping.reschedule_follow_up",
        key=idempotency_key,
        request_payload={
            "followUpId": str(follow_up_id),
            "dueAt": due_at.isoformat(),
            "reason": note,
        },
        command=command,
    )
    return FollowUpCommandResult(
        follow_up=load_follow_up(context, stored.payload["followUpId"]),
        replayed=stored.replayed,
    )
