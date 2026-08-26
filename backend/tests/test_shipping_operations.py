from __future__ import annotations

import json
from typing import Any

import pytest
from django.test import Client, override_settings
from django.utils import timezone

from apps.inventory.services import create_product
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.sales.models import Order
from apps.sales.order_services import confirm_manual_payment, create_order, set_buyer_details
from apps.shipping.models import Shipment, ShipmentEvent
from apps.users.models import User
from tenda.crypto import decrypt_credential

pytestmark = pytest.mark.django_db(transaction=True)

PASSWORD = "Correct-Horse-Battery-42"


def identity(email: str) -> tuple[User, TenantContext]:
    user = User.objects.create_user(
        email=email,
        password=PASSWORD,
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    return user, resolve_tenant_context(user)


def signed_in(email: str) -> tuple[Client, TenantContext]:
    user, context = identity(email)
    client = Client()
    response = client.post(
        "/api/v1/auth/login",
        data=json.dumps({"email": user.email, "password": PASSWORD}),
        content_type="application/json",
    )
    assert response.status_code == 200
    return client, context


def graphql(client: Client, query: str, **variables: Any) -> dict[str, Any]:
    response = client.post(
        "/graphql/",
        data=json.dumps({"query": query, "variables": variables}),
        content_type="application/json",
    )
    payload: dict[str, Any] = response.json()
    return payload


def paid_order(context: TenantContext, *, name: str = "Velón") -> Order:
    product = create_product(
        context=context,
        name=name,
        purchase_price="400",
        sale_price="1000",
        initial_quantity=3,
    ).product
    order = create_order(
        context=context,
        lines=[
            {
                "productId": str(product.public_id),
                "quantity": 1,
                "unitSalePrice": "1000",
            }
        ],
        delivery_mode=Order.DeliveryMode.SHIPPING,
        payment_method=Order.PaymentMethod.CASH,
        idempotency_key=f"create-{product.public_id}",
    ).order
    token = decrypt_credential(order.public_token_ciphertext)
    set_buyer_details(
        token=token,
        details={
            "name": "Camila Soto",
            "email": "camila@example.cl",
            "recipientName": "Camila Soto",
            "addressLine": "Los Aromos 123",
            "municipality": "Ñuñoa",
            "city": "Santiago",
        },
        correlation_id="buyer",
    )
    confirm_manual_payment(
        context=context,
        order_id=order.public_id,
        amount="1000",
        paid_at=timezone.now(),
        note="Pago en efectivo",
        idempotency_key=f"pay-{order.public_id}",
        correlation_id="pay",
    )
    order.refresh_from_db()
    return order


def test_graphql_exposes_shipping_query_and_mutation_names() -> None:
    client, _context = signed_in("ship-schema@example.com")
    payload = graphql(
        client,
        """
        query {
          queryType: __type(name: "Query") { fields { name } }
          mutationType: __type(name: "Mutation") { fields { name } }
        }
        """,
    )
    query_names = {field["name"] for field in payload["data"]["queryType"]["fields"]}
    mutation_names = {field["name"] for field in payload["data"]["mutationType"]["fields"]}
    assert {
        "shippingDashboard",
        "shipments",
        "shipment",
        "shipmentTimeline",
        "ticket",
    } <= query_names
    assert {
        "updateShipment",
        "markShipmentDispatched",
        "generateShipmentLabel",
        "openPublicTicket",
        "sendTicketMessage",
        "resolveTicket",
        "rescheduleFollowUp",
        "registerReturnCase",
        "confirmReturnToStock",
    } <= mutation_names


def test_dashboard_list_and_detail_are_tenant_safe() -> None:
    client_a, context_a = signed_in("ship-a@example.com")
    client_b, _context_b = signed_in("ship-b@example.com")
    order = paid_order(context_a)
    shipment = order.shipment

    dashboard = graphql(
        client_a,
        """
        query {
          shippingDashboard {
            total pending preparing dispatched deliveryCheck issue attention
          }
        }
        """,
    )
    assert dashboard["data"]["shippingDashboard"]["pending"] == 1
    assert dashboard["data"]["shippingDashboard"]["attention"] == 1

    listing = graphql(
        client_a,
        """
        query {
          shipments(first: 10) {
            totalCount
            nodes { id number status recipientName nextAction allowedActions }
          }
        }
        """,
    )
    nodes = listing["data"]["shipments"]["nodes"]
    assert listing["data"]["shipments"]["totalCount"] == 1
    assert nodes[0]["id"] == str(shipment.public_id)
    assert nodes[0]["recipientName"] == "Camila Soto"
    assert nodes[0]["nextAction"] == "prepare"
    assert "updateShipment" in nodes[0]["allowedActions"]

    foreign = graphql(
        client_b,
        """
        query {
          shippingDashboard { total }
          shipments { totalCount nodes { id } }
        }
        """,
    )
    assert foreign["data"]["shippingDashboard"]["total"] == 0
    assert foreign["data"]["shipments"]["totalCount"] == 0

    hidden = graphql(
        client_b,
        """
        query ($id: ID!) {
          shipment(id: $id) { id }
        }
        """,
        id=str(shipment.public_id),
    )
    assert hidden["data"]["shipment"] is None
    assert hidden["errors"][0]["extensions"]["code"] == "NOT_FOUND"


def test_update_then_dispatch_is_idempotent_and_locks_edits() -> None:
    client, context = signed_in("ship-ops@example.com")
    order = paid_order(context)
    shipment_id = str(order.shipment.public_id)
    update = """
    mutation Update($id: ID!, $input: UpdateShipmentInput!, $key: String!) {
      updateShipment(shipmentId: $id, input: $input, idempotencyKey: $key) {
        replayed
        shipment {
          status
          carrier
          trackingCode
          trackingUrl
          allowedActions
          timeline { title detail isPublic actorName }
        }
      }
    }
    """
    payload = {
        "carrier": "Chilexpress",
        "trackingCode": "CX-99",
        "trackingUrl": "https://chilexpress.cl/track/CX-99",
        "comment": "Nota interna del operador",
        "internalNote": True,
    }
    first = graphql(client, update, id=shipment_id, input=payload, key="upd-1")
    replay = graphql(client, update, id=shipment_id, input=payload, key="upd-1")
    assert "errors" not in first, first.get("errors")
    shipment_data = first["data"]["updateShipment"]["shipment"]
    assert first["data"]["updateShipment"]["replayed"] is False
    assert replay["data"]["updateShipment"]["replayed"] is True
    assert shipment_data["status"] == "preparing"
    assert shipment_data["carrier"] == "Chilexpress"
    assert shipment_data["trackingCode"] == "CX-99"
    internal = [item for item in shipment_data["timeline"] if item["isPublic"] is False]
    assert internal
    assert internal[0]["actorName"] == "ship-ops@example.com"

    dispatch = """
    mutation Dispatch($id: ID!, $key: String!) {
      markShipmentDispatched(shipmentId: $id, idempotencyKey: $key) {
        replayed
        shipment { status allowedActions trackingCode dispatchedAt }
      }
    }
    """
    dispatched = graphql(client, dispatch, id=shipment_id, key="disp-1")
    dispatched_again = graphql(client, dispatch, id=shipment_id, key="disp-1")
    assert "errors" not in dispatched, dispatched.get("errors")
    assert dispatched["data"]["markShipmentDispatched"]["shipment"]["status"] == "dispatched"
    assert dispatched_again["data"]["markShipmentDispatched"]["replayed"] is True
    assert (
        "updateShipment"
        not in dispatched["data"]["markShipmentDispatched"]["shipment"]["allowedActions"]
    )

    blocked = graphql(
        client,
        update,
        id=shipment_id,
        input={"carrier": "Starken", "trackingCode": "ST-1"},
        key="upd-after",
    )
    assert blocked["errors"][0]["extensions"]["code"] == "SHIPMENT_NOT_EDITABLE"
    order.shipment.refresh_from_db()
    assert order.shipment.carrier == "Chilexpress"
    assert ShipmentEvent.objects.filter(shipment=order.shipment).count() >= 3


@override_settings(PUBLIC_ORIGIN="https://shop.example.test")
def test_attention_filter_and_timeline_query() -> None:
    client, context = signed_in("ship-filter@example.com")
    order = paid_order(context)
    shipment_id = str(order.shipment.public_id)

    attention = graphql(
        client,
        """
        query {
          shipments(filter: { attention: true }) {
            totalCount
            nodes { status nextAction }
          }
        }
        """,
    )
    assert attention["data"]["shipments"]["totalCount"] == 1
    assert attention["data"]["shipments"]["nodes"][0]["status"] == "pending"

    graphql(
        client,
        """
        mutation Dispatch($id: ID!, $key: String!) {
          markShipmentDispatched(shipmentId: $id, idempotencyKey: $key) {
            shipment { status }
          }
        }
        """,
        id=shipment_id,
        key="go",
    )
    remaining = graphql(
        client,
        """
        query {
          shipments(filter: { attention: true, statuses: ["pending"] }) {
            totalCount
          }
        }
        """,
    )
    assert remaining["data"]["shipments"]["totalCount"] == 0

    timeline = graphql(
        client,
        """
        query ($id: ID!) {
          shipmentTimeline(id: $id) { eventType title isPublic }
        }
        """,
        id=shipment_id,
    )
    types = [item["eventType"] for item in timeline["data"]["shipmentTimeline"]]
    assert "shipment.created" in types
    assert "shipment.preparing" in types
    assert "shipment.dispatched" in types
    assert Shipment.objects.filter(public_id=shipment_id).count() == 1
