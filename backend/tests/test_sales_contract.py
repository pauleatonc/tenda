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
from apps.sales.order_services import create_order, publish_order_link, set_buyer_details
from apps.users.models import User
from tenda.crypto import decrypt_credential

pytestmark = pytest.mark.django_db(transaction=True)

PASSWORD = "Correct-Horse-Battery-42"


def seed_bank_details(organisation) -> None:
    organisation.bank_name = "BancoEstado"
    organisation.bank_account_type = "cuenta_corriente"
    organisation.bank_account_number = "12345678"
    organisation.bank_holder_tax_id = "11.111.111-1"
    organisation.bank_confirmation_email = "pagos@example.com"
    organisation.save(
        update_fields=(
            "bank_name",
            "bank_account_type",
            "bank_account_number",
            "bank_holder_tax_id",
            "bank_confirmation_email",
            "updated_at",
        )
    )


def identity(email: str) -> tuple[User, TenantContext]:
    user = User.objects.create_user(
        email=email,
        password=PASSWORD,
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    context = resolve_tenant_context(user)
    seed_bank_details(context.organisation)
    return user, context


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


def test_graphql_exposes_exact_stage_two_query_and_mutation_names() -> None:
    client, _context = signed_in("sales-schema@example.com")
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
        "salesDashboard",
        "orders",
        "order",
        "publicOrder",
        "publicOrderStatus",
        "salesBalance",
        "salesBalanceBreakdown",
        "sellerPaymentConnection",
        "reconciliationIssues",
    } <= query_names
    assert {
        "createOrder",
        "publishOrderLink",
        "setBuyerDetails",
        "updateOrderBuyer",
        "initiateMercadoPagoCheckout",
        "reviewPaymentProof",
        "confirmManualPayment",
        "cancelOrder",
        "restoreOrder",
        "refundPayment",
        "resendOrderLink",
        "sendOfferLink",
        "reissueBankTransferOffer",
        "retryReconciliation",
    } <= mutation_names


@override_settings(PUBLIC_ORIGIN="https://shop.example.test")
def test_graphql_create_publish_seller_and_public_shapes_are_tenant_safe() -> None:
    client, context = signed_in("sales-graphql@example.com")
    product = create_product(
        context=context,
        name="Vela <privada>",
        purchase_price="400",
        sale_price="1000",
        initial_quantity=2,
    ).product
    mutation = """
    mutation Create($input: CreateOrderInput!, $key: String!) {
      createOrder(input: $input, idempotencyKey: $key) {
        replayed
        order {
          id number status statusLabel total
          lines { productName quantity unitSalePrice unitCostSnapshot }
          permissions { canViewCosts allowedActions }
          reservationExpiresAt reconciliationStatus
        }
      }
    }
    """
    create_input = {
        "lines": [
            {
                "productId": str(product.public_id),
                "quantity": 2,
                "unitSalePrice": "900",
            }
        ],
        "deliveryMode": "pickup",
        "paymentMethod": "cash",
    }
    created = graphql(client, mutation, input=create_input, key="graphql-order")
    replay = graphql(client, mutation, input=create_input, key="graphql-order")
    assert "errors" not in created, created.get("errors")
    order_data = created["data"]["createOrder"]["order"]
    order_id = order_data["id"]
    assert order_data["status"] == "reserved"
    assert order_data["statusLabel"] == "Reservado"
    assert order_data["total"] == "1800"
    assert order_data["lines"][0]["unitCostSnapshot"] == "400"
    assert replay["data"]["createOrder"]["replayed"] is True

    published = graphql(
        client,
        """
        mutation Publish($id: ID!, $key: String!) {
          publishOrderLink(orderId: $id, idempotencyKey: $key) {
            publicUrl replayed order { id publishedAt allowedActions }
          }
        }
        """,
        id=order_id,
        key="publish-order",
    )
    public_url = published["data"]["publishOrderLink"]["publicUrl"]
    token = public_url.rsplit("/", maxsplit=1)[-1]
    assert public_url.startswith("https://shop.example.test/p/")

    listing = graphql(
        client,
        """
        query Seller($id: ID!) {
          salesDashboard { totalOrders activeOrders confirmedGross }
          orders(first: 10, status: "reserved", search: "VEN-") {
            totalCount pageInfo { hasNextPage endCursor }
            nodes { id number paymentMethod total }
          }
          order(id: $id) {
            id buyer payment timeline { eventType title }
            publicUrl permissions { canViewCosts }
          }
          salesBalance { confirmedGross pendingAmount costCoverage costIncomplete }
          salesBalanceBreakdown(first: 10) {
            totalCount pageInfo { hasNextPage endCursor }
            nodes { period productName confirmedGross }
          }
        }
        """,
        id=order_id,
    )
    assert "errors" not in listing, listing.get("errors")
    assert listing["data"]["orders"]["totalCount"] == 1
    assert listing["data"]["salesDashboard"]["activeOrders"] == 1
    assert listing["data"]["salesBalance"]["pendingAmount"] == "1800"

    public = graphql(
        Client(),
        """
        query Public($token: String!) {
          publicOrder(token: $token) {
            number status total
            lines { productName quantity unitSalePrice lineTotal }
            seller { name phone businessEmail }
            allowedActions
          }
          publicOrderStatus(token: $token) {
            status statusLabel isExpired reconciliationStatus
          }
        }
        """,
        token=token,
    )
    assert "errors" not in public, public.get("errors")
    serialized = json.dumps(public)
    assert public["data"]["publicOrder"]["total"] == "1800"
    assert str(product.public_id) not in serialized
    assert "unitCostSnapshot" not in serialized

    _foreign_client, foreign_context = signed_in("sales-foreign@example.com")
    foreign = graphql(
        _foreign_client,
        "query($id: ID!) { order(id: $id) { id number } }",
        id=order_id,
    )
    assert foreign["errors"][0]["extensions"]["code"] == "NOT_FOUND"
    assert foreign_context.organisation != context.organisation


def test_public_html_escapes_metadata_and_contextual_upload_routes_are_scoped() -> None:
    client, context = signed_in("sales-public-rest@example.com")
    product = create_product(
        context=context,
        name='Marco "especial" <script>',
        sale_price="3000",
        initial_quantity=1,
    ).product
    order = create_order(
        context=context,
        lines=[
            {
                "productId": str(product.public_id),
                "quantity": 1,
                "unitSalePrice": "3000",
            }
        ],
        delivery_mode=Order.DeliveryMode.PICKUP,
        payment_method=Order.PaymentMethod.BANK_TRANSFER,
        idempotency_key="public-rest-order",
    ).order
    publish_order_link(
        context=context,
        order_id=order.public_id,
        idempotency_key="public-rest-publish",
    )
    token = decrypt_credential(order.public_token_ciphertext)
    set_buyer_details(
        token=token,
        details={
            "name": "Ana",
            "email": "ana@example.com",
            "phone": "+56911111111",
            "recipientName": "Ana",
            "recipientTaxId": "11.111.111-1",
            "addressLine": "Los Aromos 123",
            "commune": "Ñuñoa",
            "region": "Región Metropolitana de Santiago",
        },
    )

    page = Client().get(f"/p/{token}")
    assert page.status_code == 200
    html = page.content.decode()
    assert "&lt;script&gt;" in html
    assert "<script>" not in html
    assert str(context.organisation.public_id) not in html
    assert order.public_token_hash not in html

    public_client = Client()
    prepared = public_client.post(
        f"/api/v1/public/orders/{token}/payment-proof/uploads/prepare",
        data=json.dumps(
            {
                "fileName": "comprobante.png",
                "contentType": "image/png",
                "size": 4,
            }
        ),
        content_type="application/json",
    )
    assert prepared.status_code == 201
    asset_id = prepared.json()["data"]["assetId"]
    uploaded = public_client.put(
        f"/api/v1/public/orders/{token}/payment-proof/uploads/fake/{asset_id}",
        data=b"data",
        content_type="image/png",
    )
    completed = public_client.post(
        f"/api/v1/public/orders/{token}/payment-proof/uploads/complete",
        data=json.dumps({"assetId": asset_id}),
        content_type="application/json",
    )
    assert uploaded.status_code == 200
    assert completed.status_code == 200
    assert completed.json()["data"]["orderStatus"] == "purchase_validation"

    other_client, other_context = signed_in("sales-public-other@example.com")
    other_product = create_product(
        context=other_context,
        name="Otro",
        initial_quantity=1,
    ).product
    other_order = create_order(
        context=other_context,
        lines=[
            {
                "productId": str(other_product.public_id),
                "quantity": 1,
                "unitSalePrice": "100",
            }
        ],
        delivery_mode=Order.DeliveryMode.PICKUP,
        payment_method=Order.PaymentMethod.BANK_TRANSFER,
        idempotency_key="other-order",
    ).order
    other_token = decrypt_credential(other_order.public_token_ciphertext)
    denied = other_client.post(
        f"/api/v1/public/orders/{other_token}/payment-proof/uploads/complete",
        data=json.dumps({"assetId": asset_id}),
        content_type="application/json",
    )
    assert denied.status_code == 404
