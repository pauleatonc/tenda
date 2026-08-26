from __future__ import annotations

import json
from datetime import timedelta
from typing import Any

import pytest
from django.test import Client, override_settings
from django.utils import timezone

from apps.inventory.selectors import products_for_inventory
from apps.organisations.selectors import TenantContext
from apps.shipping.models import DeliveryConfirmation, Shipment, ShipmentEvent, Ticket
from apps.shipping.services import mark_shipment_dispatched
from tenda.crypto import decrypt_credential
from tests.test_shipping_operations import graphql, paid_order, signed_in

pytestmark = pytest.mark.django_db(transaction=True)

PUBLIC_SHIPMENT = """
query Public($token: String!) {
  publicShipment(token: $token) {
    number
    publicStatus
    publicStatusLabel
    orderNumber
    carrier
    trackingCode
    trackingUrl
    dispatchedAt
    canConfirm
    allowedActions
    seller { name phone businessEmail }
    lines { productName quantity }
    timeline { title detail createdAt }
    confirmation { outcome comment createdAt }
  }
}
"""


def _token(shipment: Shipment) -> str:
    return decrypt_credential(shipment.public_token_ciphertext)


def _dispatch(context: TenantContext, shipment: Shipment) -> Shipment:
    result = mark_shipment_dispatched(
        context=context,
        shipment_id=shipment.public_id,
        idempotency_key=f"dispatch-{shipment.public_id}",
        comment="Salió a Chilexpress",
        correlation_id="dispatch",
    )
    return result.shipment


def _confirm(
    client: Client,
    token: str,
    *,
    outcome: str,
    comment: str = "",
    key: str = "",
) -> Any:
    body: dict[str, Any] = {
        "outcome": outcome,
        "comment": comment,
        "turnstileToken": "local-development",
    }
    if key:
        body["idempotencyKey"] = key
    return client.post(
        f"/api/v1/public/shipments/{token}/confirm",
        data=json.dumps(body),
        content_type="application/json",
    )


def test_graphql_exposes_public_shipment() -> None:
    client, _context = signed_in("pub-schema@example.com")
    payload = graphql(
        client,
        """
        query {
          queryType: __type(name: "Query") { fields { name } }
        }
        """,
    )
    names = {field["name"] for field in payload["data"]["queryType"]["fields"]}
    assert "publicShipment" in names


def test_html_and_public_query_hide_internal_notes_and_hashes() -> None:
    client, context = signed_in("pub-html@example.com")
    order = paid_order(context)
    shipment = order.shipment
    token = _token(shipment)

    update = graphql(
        client,
        """
        mutation Update($id: ID!, $input: UpdateShipmentInput!, $key: String!) {
          updateShipment(shipmentId: $id, input: $input, idempotencyKey: $key) {
            shipment { id }
          }
        }
        """,
        id=str(shipment.public_id),
        input={
            "carrier": "Chilexpress",
            "trackingCode": "CX-99",
            "trackingUrl": "https://chilexpress.cl/track/CX-99",
            "comment": "Nota interna secreta",
            "internalNote": True,
        },
        key="internal-note",
    )
    assert "errors" not in update, update.get("errors")
    shipment = _dispatch(context, shipment)

    page = Client().get(f"/s/{token}")
    assert page.status_code == 200
    html = page.content.decode()
    assert "noindex" in html
    assert order.number in html
    assert shipment.number in html
    assert "Despachado" in html
    assert context.organisation.name in html
    assert shipment.public_token_hash not in html
    assert str(context.organisation.public_id) not in html
    assert "Nota interna secreta" not in html
    assert "<script>" not in html

    missing = Client().get("/s/token-inventado")
    assert missing.status_code == 404
    body = missing.content.decode()
    assert "Este enlace no está disponible" in body
    assert "Nota interna" not in body

    public_client = Client()
    visible = graphql(public_client, PUBLIC_SHIPMENT, token=token)
    assert "errors" not in visible, visible.get("errors")
    data = visible["data"]["publicShipment"]
    assert data["publicStatus"] == "dispatched"
    assert data["publicStatusLabel"] == "Despachado"
    assert data["orderNumber"] == order.number
    assert data["canConfirm"] is True
    assert "confirmReceived" in data["allowedActions"]
    assert data["lines"][0]["productName"] == "Velón"
    assert data["trackingCode"] == "CX-99"
    assert data["carrier"] == "Chilexpress"
    titles = [item["title"] for item in data["timeline"]]
    assert "Chequeo de entrega" not in titles
    assert all("Nota interna secreta" not in (item["detail"] or "") for item in data["timeline"])
    assert all("delivery_check" not in item["title"] for item in data["timeline"])

    other_client, _other = signed_in("pub-other@example.com")
    foreign = graphql(other_client, PUBLIC_SHIPMENT, token=token)
    assert foreign["data"]["publicShipment"]["number"] == shipment.number
    unknown = graphql(public_client, PUBLIC_SHIPMENT, token=f"{token}-wrong")
    assert unknown["data"]["publicShipment"] is None
    assert unknown["errors"][0]["extensions"]["code"] == "NOT_FOUND"


def test_confirm_received_is_idempotent_and_moves_to_history() -> None:
    client, context = signed_in("pub-received@example.com")
    order = paid_order(context)
    product_id = order.items.get().product_id
    shipment = _dispatch(context, order.shipment)
    token = _token(shipment)
    before = products_for_inventory(context).get(pk=product_id)
    assert before.active_fulfilment == 1

    public_client = Client()
    first = _confirm(public_client, token, outcome="received", key="confirm-1")
    replay = _confirm(public_client, token, outcome="received", key="confirm-1")
    other_outcome = _confirm(public_client, token, outcome="needs_help")
    assert first.status_code == 200, first.content
    assert replay.status_code == 200
    assert other_outcome.status_code == 200
    payload = first.json()["data"]
    assert payload["replayed"] is False
    assert payload["outcome"] == "received"
    assert payload["publicStatus"] == "received"
    assert payload["publicStatusLabel"] == "Recibido"
    assert payload["nextAction"] == "none"
    assert replay.json()["data"]["replayed"] is True
    assert other_outcome.json()["data"]["outcome"] == "received"
    assert other_outcome.json()["data"]["replayed"] is True
    assert DeliveryConfirmation.objects.filter(shipment=shipment).count() == 1
    delivered_events = ShipmentEvent.objects.filter(
        shipment=shipment,
        event_type="shipment.delivered",
    )
    assert delivered_events.count() == 1

    shipment.refresh_from_db()
    assert shipment.status == Shipment.Status.DELIVERED
    after = products_for_inventory(context).get(pk=product_id)
    assert after.active_fulfilment == 0

    breakdown = graphql(
        client,
        """
        query ($id: ID!) {
          product(id: $id) { stock { activeFulfilment } }
          productStockBreakdown(productId: $id) {
            lines { kind label quantity }
          }
        }
        """,
        id=str(order.items.get().product.public_id),
    )
    assert breakdown["data"]["product"]["stock"]["activeFulfilment"] == 0
    sold = [
        line
        for line in breakdown["data"]["productStockBreakdown"]["lines"]
        if line["kind"] == "sold"
    ]
    assert sold == []


def test_needs_help_does_not_mark_issue() -> None:
    _client, context = signed_in("pub-help@example.com")
    order = paid_order(context)
    shipment = _dispatch(context, order.shipment)
    token = _token(shipment)

    public_client = Client()
    first = _confirm(public_client, token, outcome="needs_help", comment="Llegó dañado")
    replay = _confirm(public_client, token, outcome="needs_help")
    assert first.status_code == 200, first.content
    data = first.json()["data"]
    assert data["replayed"] is False
    assert data["outcome"] == "needs_help"
    assert data["publicStatus"] == "needs_help"
    assert data["publicStatusLabel"] == "Hay una consulta"
    assert data["nextAction"] == "open_ticket"
    assert replay.json()["data"]["replayed"] is True

    shipment.refresh_from_db()
    assert shipment.status == Shipment.Status.DISPATCHED
    confirmation = DeliveryConfirmation.objects.get(shipment=shipment)
    assert confirmation.outcome == DeliveryConfirmation.Outcome.NEEDS_HELP
    assert confirmation.comment == "Llegó dañado"
    assert not ShipmentEvent.objects.filter(
        shipment=shipment,
        to_status=Shipment.Status.ISSUE,
    ).exists()
    ticket = Ticket.objects.get(shipment=shipment)
    assert ticket.status == Ticket.Status.AWAITING_SELLER
    assert ticket.contact_email == "camila@example.cl"

    visible = graphql(Client(), PUBLIC_SHIPMENT, token=token)
    public_data = visible["data"]["publicShipment"]
    assert public_data["publicStatus"] == "needs_help"
    assert public_data["canConfirm"] is False
    assert "Hay una consulta" in public_data["publicStatusLabel"]
    assert any("necesitas ayuda" in item["title"].lower() for item in public_data["timeline"])


def test_confirm_rejects_pending_and_expired_token() -> None:
    _client, context = signed_in("pub-guards@example.com")
    order = paid_order(context)
    shipment = order.shipment
    token = _token(shipment)

    pending = _confirm(Client(), token, outcome="received")
    assert pending.status_code == 409
    assert pending.json()["error"]["code"] == "SHIPMENT_NOT_CONFIRMABLE"

    _dispatch(context, shipment)
    Shipment.objects.filter(pk=shipment.pk).update(
        public_token_expires_at=timezone.now() - timedelta(days=1)
    )
    expired_page = Client().get(f"/s/{token}")
    assert expired_page.status_code == 404
    expired_query = graphql(Client(), PUBLIC_SHIPMENT, token=token)
    assert expired_query["errors"][0]["extensions"]["code"] == "PUBLIC_TOKEN_EXPIRED"
    expired_confirm = _confirm(Client(), token, outcome="received")
    assert expired_confirm.status_code == 404
    assert expired_confirm.json()["error"]["code"] == "PUBLIC_TOKEN_EXPIRED"


@override_settings(AUTH_RATE_LIMITS={"public_shipment_confirm": (1, 300, 300)})
def test_public_confirm_is_rate_limited() -> None:
    _client, context = signed_in("pub-limit@example.com")
    order = paid_order(context)
    shipment = _dispatch(context, order.shipment)
    token = _token(shipment)
    public_client = Client()
    first = _confirm(public_client, token, outcome="received")
    second = _confirm(public_client, token, outcome="received")
    assert first.status_code == 200
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "AUTH_RATE_LIMITED"


def test_seller_detail_exposes_public_url() -> None:
    client, context = signed_in("pub-seller-url@example.com")
    order = paid_order(context)
    shipment = order.shipment
    token = _token(shipment)
    detail = graphql(
        client,
        """
        query ($id: ID!) {
          shipment(id: $id) { publicUrl confirmation { outcome } }
        }
        """,
        id=str(shipment.public_id),
    )
    assert "errors" not in detail, detail.get("errors")
    assert detail["data"]["shipment"]["publicUrl"].endswith(f"/s/{token}")
    assert detail["data"]["shipment"]["confirmation"] is None
