from __future__ import annotations

import pytest
from django.test import Client, override_settings

from apps.notifications.models import OutboxEvent
from apps.notifications.providers import fake_email_provider
from apps.organisations.selectors import TenantContext
from apps.shipping.models import Shipment, Ticket
from apps.shipping.services import mark_shipment_dispatched
from tenda.crypto import decrypt_outbox_value
from tests.test_shipping_operations import graphql, paid_order, signed_in
from tests.test_shipping_public import _confirm, _token

pytestmark = pytest.mark.django_db(transaction=True)

OPEN_TICKET = """
mutation Open($token: String!, $input: OpenPublicTicketInput!, $key: String!) {
  openPublicTicket(token: $token, input: $input, idempotencyKey: $key) {
    replayed
    ticket {
      id
      number
      status
      category
      contactEmail
      messages { authorKind body }
    }
  }
}
"""

SEND_MESSAGE = """
mutation Send(
  $ticketId: ID!
  $body: String!
  $key: String!
  $token: String
  $turnstile: String
) {
  sendTicketMessage(
    ticketId: $ticketId
    body: $body
    idempotencyKey: $key
    token: $token
    turnstileToken: $turnstile
  ) {
    replayed
    ticket { id status messages { authorKind body } }
  }
}
"""

RESOLVE = """
mutation Resolve($ticketId: ID!, $key: String!, $comment: String) {
  resolveTicket(ticketId: $ticketId, comment: $comment, idempotencyKey: $key) {
    replayed
    ticket { id status messages { authorKind body } }
  }
}
"""

PUBLIC_TICKET = """
query Public($token: String!) {
  publicShipment(token: $token) {
    publicStatus
    canConfirm
    allowedActions
    ticket {
      id
      status
      contactEmail
      messages { authorKind body }
    }
    buyerContact { name email phone }
  }
}
"""

SELLER_TICKET = """
query Ticket($id: ID!) {
  ticket(id: $id) {
    id
    number
    status
    shipment { id number orderNumber }
    messages { authorKind body }
  }
}
"""


def _dispatch(context: TenantContext, shipment: Shipment) -> Shipment:
    return mark_shipment_dispatched(
        context=context,
        shipment_id=shipment.public_id,
        idempotency_key=f"dispatch-{shipment.public_id}",
        comment="Salió a Chilexpress",
        correlation_id="dispatch",
    ).shipment


def _open_input(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "category": "damaged",
        "message": "El velón llegó con la cera quebrada.",
        "contactName": "Camila Soto",
        "contactEmail": "camila@example.cl",
        "contactPhone": "+56911111111",
        "turnstileToken": "local-development",
    }
    payload.update(overrides)
    return payload


def test_open_public_ticket_reuses_open_thread_and_hides_body_from_email() -> None:
    _seller, context = signed_in("ticket-open@example.com")
    order = paid_order(context)
    shipment = _dispatch(context, order.shipment)
    token = _token(shipment)
    fake_email_provider.clear()
    public_client = Client()

    first = graphql(
        public_client,
        OPEN_TICKET,
        token=token,
        input=_open_input(),
        key="open-1",
    )
    replay = graphql(
        public_client,
        OPEN_TICKET,
        token=token,
        input=_open_input(),
        key="open-1",
    )
    second = graphql(
        public_client,
        OPEN_TICKET,
        token=token,
        input=_open_input(message="Además falta el incienso que iba en el pedido."),
        key="open-2",
    )
    assert "errors" not in first, first.get("errors")
    assert first["data"]["openPublicTicket"]["replayed"] is False
    assert replay["data"]["openPublicTicket"]["replayed"] is True
    assert second["data"]["openPublicTicket"]["replayed"] is False
    ticket_id = first["data"]["openPublicTicket"]["ticket"]["id"]
    assert second["data"]["openPublicTicket"]["ticket"]["id"] == ticket_id
    assert Ticket.objects.filter(shipment=shipment).count() == 1
    ticket = Ticket.objects.get(public_id=ticket_id)
    assert ticket.status == Ticket.Status.AWAITING_SELLER
    assert ticket.messages.count() == 2

    events = OutboxEvent.objects.filter(event_type="shipping.ticket_notification")
    assert events.exists()
    for event in events:
        payload = event.payload
        serialized = str(payload)
        assert payload["parameters"] == {
            "ticketNumber": ticket.number,
            "shipmentNumber": shipment.number,
            "orderNumber": order.number,
        }
        assert "linkCiphertext" in payload
        assert "El velón llegó" not in serialized
        assert "camila@example.cl" not in str(payload.get("parameters"))
        link = decrypt_outbox_value(str(payload["linkCiphertext"]))
        assert str(shipment.public_id) in link
        assert str(ticket.public_id) in link
        assert "/app/despachos/" in link

    emails = fake_email_provider.messages()
    assert emails
    for email in emails:
        assert "El velón llegó" not in str(email.parameters)
        assert email.parameters["ticketNumber"] == ticket.number
        assert "ticketUrl" in email.parameters


def test_buyer_and_seller_replies_flip_awaiting_and_keep_history() -> None:
    seller_client, context = signed_in("ticket-thread@example.com")
    order = paid_order(context)
    shipment = _dispatch(context, order.shipment)
    token = _token(shipment)
    public_client = Client()
    opened = graphql(
        public_client,
        OPEN_TICKET,
        token=token,
        input=_open_input(),
        key="thread-open",
    )
    ticket_id = opened["data"]["openPublicTicket"]["ticket"]["id"]

    seller_reply = graphql(
        seller_client,
        SEND_MESSAGE,
        ticketId=ticket_id,
        body="Lamento el daño, te envío un reemplazo esta semana.",
        key="seller-1",
    )
    assert "errors" not in seller_reply, seller_reply.get("errors")
    assert seller_reply["data"]["sendTicketMessage"]["ticket"]["status"] == "awaiting_buyer"

    buyer_reply = graphql(
        public_client,
        SEND_MESSAGE,
        ticketId=ticket_id,
        body="Perfecto, avisame cuando salga el reemplazo por favor.",
        key="buyer-1",
        token=token,
        turnstile="local-development",
    )
    assert "errors" not in buyer_reply, buyer_reply.get("errors")
    assert buyer_reply["data"]["sendTicketMessage"]["ticket"]["status"] == "awaiting_seller"
    bodies = [
        item["body"] for item in buyer_reply["data"]["sendTicketMessage"]["ticket"]["messages"]
    ]
    assert "El velón llegó con la cera quebrada." in bodies
    assert "Lamento el daño, te envío un reemplazo esta semana." in bodies
    assert "Perfecto, avisame cuando salga el reemplazo por favor." in bodies


def test_resolve_ticket_blocks_new_messages_without_closing() -> None:
    seller_client, context = signed_in("ticket-resolve@example.com")
    order = paid_order(context)
    shipment = _dispatch(context, order.shipment)
    token = _token(shipment)
    public_client = Client()
    opened = graphql(
        public_client,
        OPEN_TICKET,
        token=token,
        input=_open_input(),
        key="resolve-open",
    )
    ticket_id = opened["data"]["openPublicTicket"]["ticket"]["id"]
    resolved = graphql(
        seller_client,
        RESOLVE,
        ticketId=ticket_id,
        key="resolve-1",
        comment="Reemplazo despachado con el mismo transportista.",
    )
    replay = graphql(
        seller_client,
        RESOLVE,
        ticketId=ticket_id,
        key="resolve-1",
        comment="Reemplazo despachado con el mismo transportista.",
    )
    assert "errors" not in resolved, resolved.get("errors")
    assert resolved["data"]["resolveTicket"]["replayed"] is False
    assert replay["data"]["resolveTicket"]["replayed"] is True
    assert resolved["data"]["resolveTicket"]["ticket"]["status"] == "resolved"
    assert any(
        item["authorKind"] == "system"
        for item in resolved["data"]["resolveTicket"]["ticket"]["messages"]
    )
    ticket = Ticket.objects.get(public_id=ticket_id)
    assert ticket.closed_at is None
    assert ticket.resolved_at is not None

    blocked = graphql(
        public_client,
        SEND_MESSAGE,
        ticketId=ticket_id,
        body="Quería agregar un dato más sobre el daño.",
        key="after-resolve",
        token=token,
        turnstile="local-development",
    )
    assert blocked["errors"][0]["extensions"]["code"] == "TICKET_NOT_OPEN"


def test_public_token_cannot_read_or_write_another_shipment_ticket() -> None:
    client_a, context_a = signed_in("ticket-a@example.com")
    client_b, context_b = signed_in("ticket-b@example.com")
    shipment_a = _dispatch(context_a, paid_order(context_a).shipment)
    shipment_b = _dispatch(context_b, paid_order(context_b).shipment)
    token_a = _token(shipment_a)
    token_b = _token(shipment_b)
    opened = graphql(
        Client(),
        OPEN_TICKET,
        token=token_a,
        input=_open_input(),
        key="iso-open",
    )
    ticket_id = opened["data"]["openPublicTicket"]["ticket"]["id"]

    foreign_public = graphql(Client(), PUBLIC_TICKET, token=token_b)
    assert foreign_public["data"]["publicShipment"]["ticket"] is None

    stolen = graphql(
        Client(),
        SEND_MESSAGE,
        ticketId=ticket_id,
        body="Intento escribir en el ticket de otro envío.",
        key="stolen",
        token=token_b,
        turnstile="local-development",
    )
    assert stolen["errors"][0]["extensions"]["code"] == "NOT_FOUND"

    hidden = graphql(client_b, SELLER_TICKET, id=ticket_id)
    assert hidden["data"]["ticket"] is None
    assert hidden["errors"][0]["extensions"]["code"] == "NOT_FOUND"

    visible = graphql(client_a, SELLER_TICKET, id=ticket_id)
    assert "errors" not in visible, visible.get("errors")
    assert visible["data"]["ticket"]["id"] == ticket_id
    assert visible["data"]["ticket"]["shipment"]["id"] == str(shipment_a.public_id)

    public_a = graphql(Client(), PUBLIC_TICKET, token=token_a)
    assert public_a["data"]["publicShipment"]["ticket"]["id"] == ticket_id
    assert "sendTicketMessage" in public_a["data"]["publicShipment"]["allowedActions"]


def test_needs_help_reuses_existing_ticket_without_issue() -> None:
    seller_client, context = signed_in("ticket-help-reuse@example.com")
    order = paid_order(context)
    shipment = _dispatch(context, order.shipment)
    token = _token(shipment)
    opened = graphql(
        Client(),
        OPEN_TICKET,
        token=token,
        input=_open_input(category="other"),
        key="before-help",
    )
    ticket_id = opened["data"]["openPublicTicket"]["ticket"]["id"]
    help_response = _confirm(Client(), token, outcome="needs_help", comment="No llegó")
    assert help_response.status_code == 200
    assert Ticket.objects.filter(shipment=shipment).count() == 1
    Ticket.objects.get(public_id=ticket_id)
    shipment.refresh_from_db()
    assert shipment.status == Shipment.Status.DISPATCHED
    detail = graphql(
        seller_client,
        """
        query ($id: ID!) {
          shipment(id: $id) {
            status
            nextAction
            allowedActions
            activeTicket { id status }
          }
        }
        """,
        id=str(shipment.public_id),
    )
    assert detail["data"]["shipment"]["status"] == "dispatched"
    assert detail["data"]["shipment"]["nextAction"] == "reply_ticket"
    assert "resolveTicket" in detail["data"]["shipment"]["allowedActions"]
    assert detail["data"]["shipment"]["activeTicket"]["id"] == ticket_id


@override_settings(AUTH_RATE_LIMITS={"public_shipment_ticket": (1, 300, 300)})
def test_public_ticket_mutation_is_rate_limited() -> None:
    _seller, context = signed_in("ticket-limit@example.com")
    shipment = _dispatch(context, paid_order(context).shipment)
    token = _token(shipment)
    public_client = Client()
    first = graphql(
        public_client,
        OPEN_TICKET,
        token=token,
        input=_open_input(),
        key="limit-1",
    )
    second = graphql(
        public_client,
        OPEN_TICKET,
        token=token,
        input=_open_input(message="Segundo intento de abrir la misma consulta."),
        key="limit-2",
    )
    assert "errors" not in first, first.get("errors")
    assert second["errors"][0]["extensions"]["code"] == "AUTH_RATE_LIMITED"
