from __future__ import annotations

from datetime import timedelta

import pytest
from django.core.cache import cache
from django.test import Client
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.configuration.models import OperationalParameter
from apps.inventory.models import StockBalance, StockMovement
from apps.notifications.models import OutboxEvent
from apps.shipping.cadences import process_due_follow_ups
from apps.shipping.models import FollowUpSchedule, ReturnCase, Shipment, Ticket
from tests.test_shipping_operations import graphql, paid_order, signed_in
from tests.test_shipping_public import _confirm, _token
from tests.test_shipping_tickets import OPEN_TICKET, SEND_MESSAGE, _dispatch, _open_input

pytestmark = pytest.mark.django_db(transaction=True)

SHIPMENT_DETAIL = """
query ($id: ID!) {
  shipment(id: $id) {
    id
    status
    allowedActions
    nextFollowUp {
      id
      kind
      kindLabel
      status
      dueAt
      parameterKey
      parameterSource
      parameterSourceLabel
      parameterLabel
    }
    followUps { id kind status dueAt }
    returnCases { id kind kindLabel notes stockConfirmedAt }
  }
}
"""

RESCHEDULE = """
mutation ($id: ID!, $dueAt: DateTime!, $reason: String!, $key: String!) {
  rescheduleFollowUp(
    followUpId: $id
    dueAt: $dueAt
    reason: $reason
    idempotencyKey: $key
  ) {
    replayed
    followUp { id dueAt status }
    shipment { id nextFollowUp { dueAt } }
  }
}
"""

REGISTER_RETURN = """
mutation ($shipmentId: ID!, $kind: String!, $notes: String, $key: String!) {
  registerReturnCase(
    shipmentId: $shipmentId
    kind: $kind
    notes: $notes
    idempotencyKey: $key
  ) {
    replayed
    returnCase { id kind notes stockConfirmedAt }
    shipment { id status returnCases { id kind } }
  }
}
"""

CONFIRM_STOCK = """
mutation ($id: ID!, $key: String!) {
  confirmReturnToStock(returnCaseId: $id, idempotencyKey: $key) {
    replayed
    returnCase { id stockConfirmedAt }
    shipment { id status }
  }
}
"""


def _due(follow_up: FollowUpSchedule) -> FollowUpSchedule:
    follow_up.due_at = timezone.now() - timedelta(minutes=1)
    follow_up.save(update_fields=("due_at", "updated_at"))
    return follow_up


def test_dispatch_schedules_delivery_check_in_postgres() -> None:
    _client, context = signed_in("cadence-dispatch@example.com")
    order = paid_order(context)
    before = timezone.now()
    shipment = _dispatch(context, order.shipment)
    cache.clear()

    follow_up = FollowUpSchedule.objects.get(
        shipment=shipment,
        kind=FollowUpSchedule.Kind.DELIVERY_CHECK,
    )
    assert follow_up.status == FollowUpSchedule.Status.SCHEDULED
    assert follow_up.due_at >= before + timedelta(hours=71)
    assert follow_up.due_at <= timezone.now() + timedelta(hours=73)
    payload = graphql(
        _client,
        SHIPMENT_DETAIL,
        id=str(shipment.public_id),
    )
    next_follow = payload["data"]["shipment"]["nextFollowUp"]
    assert next_follow["kind"] == "delivery_check"
    assert next_follow["parameterKey"] == "shipping.delivery_check_hours"
    assert next_follow["parameterSource"] == "global"
    assert next_follow["parameterLabel"] == "72 h"
    assert "rescheduleFollowUp" in payload["data"]["shipment"]["allowedActions"]


def test_parameter_change_does_not_move_existing_due_at() -> None:
    _client, context = signed_in("cadence-param@example.com")
    first = _dispatch(context, paid_order(context).shipment)
    original = FollowUpSchedule.objects.get(shipment=first).due_at
    OperationalParameter.objects.create(
        organisation=context.organisation,
        key="shipping.delivery_check_hours",
        value=1,
        description="Override de prueba",
    )
    first.refresh_from_db()
    assert FollowUpSchedule.objects.get(shipment=first).due_at == original

    second = _dispatch(context, paid_order(context, name="Incienso").shipment)
    newer = FollowUpSchedule.objects.get(shipment=second)
    assert newer.due_at <= timezone.now() + timedelta(hours=2)


def test_due_delivery_check_moves_dispatched_shipment() -> None:
    _client, context = signed_in("cadence-due@example.com")
    shipment = _dispatch(context, paid_order(context).shipment)
    follow_up = FollowUpSchedule.objects.get(shipment=shipment)
    _due(follow_up)
    assert process_due_follow_ups() == 1
    shipment.refresh_from_db()
    follow_up.refresh_from_db()
    assert shipment.status == Shipment.Status.DELIVERY_CHECK
    assert follow_up.status == FollowUpSchedule.Status.SENT
    assert OutboxEvent.objects.filter(
        event_type="shipping.shipment_notification",
        payload__template="shipment.delivery_check_seller",
    ).exists()
    assert process_due_follow_ups() == 0


def test_ticket_reminder_then_autoclose_requires_prior_escalation() -> None:
    client, context = signed_in("cadence-autoclose@example.com")
    shipment = _dispatch(context, paid_order(context).shipment)
    token = _token(shipment)
    opened = graphql(
        Client(),
        OPEN_TICKET,
        token=token,
        input=_open_input(),
        key="open-cadence",
    )
    assert "errors" not in opened, opened.get("errors")
    ticket_id = opened["data"]["openPublicTicket"]["ticket"]["id"]
    assert (
        FollowUpSchedule.objects.filter(
            kind=FollowUpSchedule.Kind.REMINDER,
            status=FollowUpSchedule.Status.SCHEDULED,
        ).count()
        == 0
    )

    graphql(
        client,
        SEND_MESSAGE,
        ticketId=ticket_id,
        body="Hola, revisamos el velón y te contamos el siguiente paso.",
        key="seller-1",
    )
    reminder = FollowUpSchedule.objects.get(
        kind=FollowUpSchedule.Kind.REMINDER,
        status=FollowUpSchedule.Status.SCHEDULED,
    )
    assert reminder.status == FollowUpSchedule.Status.SCHEDULED
    assert reminder.ticket_id is not None

    lone_autoclose = FollowUpSchedule.objects.create(
        organisation=shipment.organisation,
        shipment=shipment,
        ticket=Ticket.objects.get(public_id=ticket_id),
        kind=FollowUpSchedule.Kind.AUTOCLOSE,
        status=FollowUpSchedule.Status.SCHEDULED,
        due_at=timezone.now() - timedelta(minutes=1),
    )
    assert process_due_follow_ups() >= 1
    lone_autoclose.refresh_from_db()
    ticket = Ticket.objects.get(public_id=ticket_id)
    assert ticket.status == Ticket.Status.AWAITING_BUYER
    assert lone_autoclose.status == FollowUpSchedule.Status.CANCELLED

    reminder.refresh_from_db()
    if reminder.status == FollowUpSchedule.Status.SCHEDULED:
        _due(reminder)
    assert process_due_follow_ups() >= 1
    reminder.refresh_from_db()
    assert reminder.status == FollowUpSchedule.Status.SENT
    autoclose = FollowUpSchedule.objects.get(
        kind=FollowUpSchedule.Kind.AUTOCLOSE,
        status=FollowUpSchedule.Status.SCHEDULED,
    )
    _due(autoclose)
    assert process_due_follow_ups() >= 1
    ticket.refresh_from_db()
    autoclose.refresh_from_db()
    assert ticket.status == Ticket.Status.CLOSED
    assert ticket.closed_at is not None
    assert autoclose.status == FollowUpSchedule.Status.SENT
    assert ticket.messages.filter(author_kind="system").exists()


def test_reschedule_follow_up_is_audited() -> None:
    client, context = signed_in("cadence-reschedule@example.com")
    shipment = _dispatch(context, paid_order(context).shipment)
    follow_up = FollowUpSchedule.objects.get(shipment=shipment)
    new_due = (timezone.now() + timedelta(hours=10)).isoformat()
    payload = graphql(
        client,
        RESCHEDULE,
        id=str(follow_up.public_id),
        dueAt=new_due,
        reason="El comprador pidió esperar al lunes.",
        key="reschedule-1",
    )
    assert "errors" not in payload, payload.get("errors")
    follow_up.refresh_from_db()
    event = AuditEvent.objects.get(action="shipping.follow_up_rescheduled")
    assert event.actor_id == context.user.id
    assert event.metadata["reason"] == "El comprador pidió esperar al lunes."
    assert abs((follow_up.due_at - timezone.now() - timedelta(hours=10)).total_seconds()) < 5


def test_register_return_case_does_not_restock_until_confirm() -> None:
    client, context = signed_in("cadence-return@example.com")
    order = paid_order(context)
    product = order.items.get().product
    on_hand = StockBalance.objects.get(product=product).on_hand
    shipment = _dispatch(context, order.shipment)
    payload = graphql(
        client,
        REGISTER_RETURN,
        shipmentId=str(shipment.public_id),
        kind="returned",
        notes="El comprador rechazó el bulto en destino.",
        key="return-1",
    )
    assert "errors" not in payload, payload.get("errors")
    case_id = payload["data"]["registerReturnCase"]["returnCase"]["id"]
    shipment.refresh_from_db()
    assert shipment.status == Shipment.Status.RETURNED
    assert payload["data"]["registerReturnCase"]["returnCase"]["stockConfirmedAt"] is None
    assert StockBalance.objects.get(product=product).on_hand == on_hand
    assert not StockMovement.objects.filter(reference_type="shipping.return_case").exists()

    replay = graphql(
        client,
        REGISTER_RETURN,
        shipmentId=str(shipment.public_id),
        kind="returned",
        notes="El comprador rechazó el bulto en destino.",
        key="return-1",
    )
    assert replay["data"]["registerReturnCase"]["replayed"] is True

    confirm = graphql(client, CONFIRM_STOCK, id=case_id, key="stock-1")
    assert "errors" not in confirm, confirm.get("errors")
    assert confirm["data"]["confirmReturnToStock"]["returnCase"]["stockConfirmedAt"]
    assert StockBalance.objects.get(product=product).on_hand == on_hand + 1
    movement = StockMovement.objects.get(reference_type="shipping.return_case")
    assert movement.movement_type == StockMovement.MovementType.ENTRY
    assert movement.quantity == 1
    assert movement.reference_public_id == case_id

    again = graphql(client, CONFIRM_STOCK, id=case_id, key="stock-2")
    assert again["data"]["confirmReturnToStock"]["replayed"] is True
    assert StockBalance.objects.get(product=product).on_hand == on_hand + 1


def test_public_needs_help_still_does_not_restock() -> None:
    _client, context = signed_in("cadence-help@example.com")
    order = paid_order(context)
    product = order.items.get().product
    on_hand = StockBalance.objects.get(product=product).on_hand
    shipment = _dispatch(context, order.shipment)
    response = _confirm(Client(), _token(shipment), outcome="needs_help", key="help-1")
    assert response.status_code == 200
    assert StockBalance.objects.get(product=product).on_hand == on_hand
    assert not ReturnCase.objects.filter(shipment=shipment).exists()
    shipment.refresh_from_db()
    assert shipment.status == Shipment.Status.DISPATCHED
