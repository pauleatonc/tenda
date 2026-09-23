from __future__ import annotations

import json
from typing import Any

import pytest
from django.test import Client
from django.utils import timezone

from apps.inventory.services import create_product
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.sales.models import Order
from apps.sales.order_services import confirm_manual_payment, create_order, set_buyer_details
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


def paid_order(
    context: TenantContext,
    *,
    name: str = "Velón",
    delivery_mode: str = Order.DeliveryMode.SHIPPING,
) -> Order:
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
        delivery_mode=delivery_mode,
        payment_method=Order.PaymentMethod.CASH,
        idempotency_key=f"create-{product.public_id}",
    ).order
    token = decrypt_credential(order.public_token_ciphertext)
    set_buyer_details(
        token=token,
        details={
            "name": "Camila Soto",
            "email": "camila@example.cl",
            "phone": "+56911111111",
            "recipientName": "Camila Soto",
            "recipientTaxId": "11.111.111-1",
            "addressLine": "Los Aromos 123",
            "commune": "Ñuñoa",
            "region": "Región Metropolitana de Santiago",
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


REGISTER = """
mutation Register($id: ID!, $input: RegisterShipmentDispatchInput!, $key: String!) {
  registerShipmentDispatch(shipmentId: $id, input: $input, idempotencyKey: $key) {
    replayed
    shipment {
      status
      statusLabel
      carrier
      trackingCode
      trackingUrl
      dispatchNote
      dispatchedAt
      deliveredAt
      allowedActions
    }
  }
}
"""


def test_graphql_exposes_only_register_and_label_operations() -> None:
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
    assert {"shippingDashboard", "shipments", "shipment"} <= query_names
    assert {"registerShipmentDispatch", "generateShipmentLabel"} <= mutation_names
    removed = {
        "shipmentTimeline",
        "ticket",
        "publicShipment",
        "updateShipment",
        "markShipmentDispatched",
        "openPublicTicket",
        "sendTicketMessage",
        "resolveTicket",
        "rescheduleFollowUp",
        "registerReturnCase",
        "confirmReturnToStock",
    }
    assert not removed & (query_names | mutation_names)


def test_dashboard_list_and_detail_are_tenant_safe() -> None:
    client_a, context_a = signed_in("ship-a@example.com")
    client_b, _context_b = signed_in("ship-b@example.com")
    order = paid_order(context_a)
    shipment = order.shipment

    dashboard = graphql(
        client_a,
        """
        query {
          shippingDashboard { total pending dispatched delivered }
        }
        """,
    )
    assert dashboard["data"]["shippingDashboard"] == {
        "total": 1,
        "pending": 1,
        "dispatched": 0,
        "delivered": 0,
    }

    listing = graphql(
        client_a,
        """
        query {
          shipments(first: 10) {
            totalCount
            nodes { id number status recipientName buyerEmail allowedActions }
          }
        }
        """,
    )
    nodes = listing["data"]["shipments"]["nodes"]
    assert listing["data"]["shipments"]["totalCount"] == 1
    assert nodes[0]["id"] == str(shipment.public_id)
    assert nodes[0]["recipientName"] == "Camila Soto"
    assert nodes[0]["buyerEmail"] == "camila@example.cl"
    assert "registerShipmentDispatch" in nodes[0]["allowedActions"]

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


def test_register_dispatch_mutation_is_idempotent_and_terminal() -> None:
    client, context = signed_in("ship-ops@example.com")
    order = paid_order(context)
    shipment_id = str(order.shipment.public_id)
    payload = {
        "carrier": "Chilexpress",
        "trackingCode": "CX-99",
        "trackingUrl": "https://chilexpress.cl/track/CX-99",
        "note": "Sale hoy",
    }

    first = graphql(client, REGISTER, id=shipment_id, input=payload, key="reg-1")
    replay = graphql(client, REGISTER, id=shipment_id, input=payload, key="reg-1")
    assert "errors" not in first, first.get("errors")
    data = first["data"]["registerShipmentDispatch"]
    assert data["replayed"] is False
    assert replay["data"]["registerShipmentDispatch"]["replayed"] is True
    assert data["shipment"]["status"] == "dispatched"
    assert data["shipment"]["statusLabel"] == "Despachado"
    assert data["shipment"]["carrier"] == "Chilexpress"
    assert data["shipment"]["trackingCode"] == "CX-99"
    assert data["shipment"]["dispatchNote"] == "Sale hoy"
    assert data["shipment"]["dispatchedAt"]
    assert data["shipment"]["deliveredAt"] is None
    assert "registerShipmentDispatch" not in data["shipment"]["allowedActions"]

    blocked = graphql(
        client,
        REGISTER,
        id=shipment_id,
        input={"carrier": "Starken"},
        key="reg-2",
    )
    assert blocked["errors"][0]["extensions"]["code"] == "SHIPMENT_ALREADY_REGISTERED"
    order.shipment.refresh_from_db()
    assert order.shipment.carrier == "Chilexpress"

    invalid_url = paid_order(context, name="Otro")
    bad = graphql(
        client,
        REGISTER,
        id=str(invalid_url.shipment.public_id),
        input={"carrier": "Starken", "trackingUrl": "not a url"},
        key="reg-3",
    )
    assert bad["errors"][0]["extensions"]["code"] == "VALIDATION_ERROR"
    assert "trackingUrl" in bad["errors"][0]["extensions"]["fieldErrors"]


def test_status_and_delivery_mode_filters() -> None:
    client, context = signed_in("ship-filter@example.com")
    shipping = paid_order(context, name="Envío")
    pickup = paid_order(context, name="Retiro", delivery_mode=Order.DeliveryMode.PICKUP)

    graphql(
        client,
        REGISTER,
        id=str(pickup.shipment.public_id),
        input={"note": "Retirado"},
        key="pickup",
    )

    pending = graphql(
        client,
        """
        query {
          shipments(filter: { statuses: ["pending"] }) { totalCount nodes { id } }
        }
        """,
    )
    assert pending["data"]["shipments"]["totalCount"] == 1
    assert pending["data"]["shipments"]["nodes"][0]["id"] == str(shipping.shipment.public_id)

    delivered = graphql(
        client,
        """
        query {
          shipments(filter: { deliveryMode: "pickup" }) {
            totalCount
            nodes { status deliveredAt carrier }
          }
        }
        """,
    )
    assert delivered["data"]["shipments"]["totalCount"] == 1
    node = delivered["data"]["shipments"]["nodes"][0]
    assert node["status"] == "delivered"
    assert node["deliveredAt"]
    assert node["carrier"] == ""

    dashboard = graphql(
        client,
        "query { shippingDashboard { total pending dispatched delivered } }",
    )
    assert dashboard["data"]["shippingDashboard"] == {
        "total": 2,
        "pending": 1,
        "dispatched": 0,
        "delivered": 1,
    }

    invalid = graphql(
        client,
        """
        query { shipments(filter: { statuses: ["closed"] }) { totalCount } }
        """,
    )
    assert invalid["errors"][0]["extensions"]["code"] == "VALIDATION_ERROR"
