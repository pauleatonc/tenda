from __future__ import annotations

import io
import json
from datetime import timedelta

import pytest
from PIL import Image
from django.test import Client
from django.utils import timezone

from apps.configuration.models import OperationalParameter
from apps.inventory.media import attach_product_media
from apps.inventory.models import StockBalance
from apps.inventory.services import create_product
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import complete_upload, prepare_upload
from apps.media_assets.storage import fake_object_storage
from apps.notifications.email_templates import render_email
from apps.notifications.models import OutboxEvent
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.sales.models import Order
from apps.sales.order_services import (
    _reservation_ttl,
    cancel_order,
    create_order,
    publish_order_link,
    reissue_bank_transfer_offer,
    restore_order,
    review_payment_proof,
    send_offer_link,
)
from apps.sales.selectors import seller_allowed_actions
from apps.sales.uploads import (
    accept_fake_receipt_upload,
    complete_receipt_upload,
    prepare_receipt_upload,
)
from apps.users.models import User
from tenda.crypto import decrypt_credential
from tenda.errors import DomainError

pytestmark = pytest.mark.django_db(transaction=True)


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
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    context = resolve_tenant_context(user)
    seed_bank_details(context.organisation)
    return user, context


def ensure_reservation_ttl(hours: int = 24, *, organisation=None) -> None:
    OperationalParameter.objects.update_or_create(
        organisation=organisation,
        key="sales.reservation_ttl_hours",
        defaults={
            "value": hours,
            "description": "test reservation ttl",
            "sensitive": False,
            "is_active": True,
        },
    )


def offer_order(context: TenantContext, *, quantity: int = 3, requested: int = 1):
    ensure_reservation_ttl(24)
    product = create_product(
        context=context,
        name="Vela depósito",
        purchase_price="400",
        sale_price="5000",
        initial_quantity=quantity,
    ).product
    order = create_order(
        context=context,
        lines=[
            {
                "productId": str(product.public_id),
                "quantity": requested,
                "unitSalePrice": "5000",
            }
        ],
        delivery_mode=Order.DeliveryMode.COORDINATED,
        payment_method=Order.PaymentMethod.BANK_TRANSFER,
        idempotency_key=f"create-{product.public_id}",
    ).order
    publish_order_link(
        context=context,
        order_id=order.public_id,
        idempotency_key=f"publish-{product.public_id}",
    )
    return order, product


def test_reservation_ttl_reads_operational_parameter() -> None:
    _user, context = identity("ttl-owner@example.com")
    ensure_reservation_ttl(24)
    assert _reservation_ttl() == timedelta(hours=24)
    OperationalParameter.objects.update_or_create(
        organisation=context.organisation,
        key="sales.reservation_ttl_hours",
        defaults={"value": 6, "description": "override", "is_active": True},
    )
    assert _reservation_ttl(organisation=context.organisation) == timedelta(hours=6)


def test_bank_transfer_offer_reserves_upload_approve_and_cancel() -> None:
    _user, context = identity("deposit-flow@example.com")
    order, product = offer_order(context, quantity=2, requested=1)
    balance = StockBalance.objects.get(product=product)
    assert order.status == Order.Status.RESERVED
    assert balance.reserved == 1
    assert balance.available == 1
    assert order.reservation_expires_at - order.created_at >= timedelta(hours=23)

    token = decrypt_credential(order.public_token_ciphertext)
    prepared = prepare_receipt_upload(
        token=token,
        original_name="comprobante.png",
        content_type="image/png",
        size=4,
    )
    accept_fake_receipt_upload(
        token=token,
        asset_id=prepared.asset.public_id,
        content=b"data",
        content_type="image/png",
    )
    complete_receipt_upload(token=token, asset_id=prepared.asset.public_id)
    order.refresh_from_db()
    assert order.status == Order.Status.PURCHASE_VALIDATION

    review_payment_proof(
        context=context,
        order_id=order.public_id,
        approved=True,
        rejection_reason="",
        idempotency_key="approve-deposit",
    )
    order.refresh_from_db()
    balance.refresh_from_db()
    assert order.status == Order.Status.PAID
    assert balance.reserved == 0
    assert balance.on_hand == 1


def test_cancel_releases_reserved_stock() -> None:
    _user, context = identity("deposit-cancel@example.com")
    order, product = offer_order(context, quantity=2, requested=1)
    cancel_order(
        context=context,
        order_id=order.public_id,
        reason="Ya no interesa",
        idempotency_key="cancel-deposit",
    )
    balance = StockBalance.objects.get(product=product)
    order.refresh_from_db()
    assert order.status == Order.Status.CANCELLED
    assert balance.reserved == 0
    assert balance.available == 2


def test_reissue_cancels_and_creates_new_reserved_offer() -> None:
    _user, context = identity("deposit-reissue@example.com")
    order, product = offer_order(context, quantity=2, requested=1)
    token = decrypt_credential(order.public_token_ciphertext)
    prepared = prepare_receipt_upload(
        token=token,
        original_name="comprobante.png",
        content_type="image/png",
        size=4,
    )
    accept_fake_receipt_upload(
        token=token,
        asset_id=prepared.asset.public_id,
        content=b"data",
        content_type="image/png",
    )
    complete_receipt_upload(token=token, asset_id=prepared.asset.public_id)

    replacement = reissue_bank_transfer_offer(
        context=context,
        order_id=order.public_id,
        idempotency_key="reissue-deposit",
    ).order
    order.refresh_from_db()
    balance = StockBalance.objects.get(product=product)
    assert order.status == Order.Status.CANCELLED
    assert replacement.status == Order.Status.RESERVED
    assert replacement.public_id != order.public_id
    assert replacement.payment_method == Order.PaymentMethod.BANK_TRANSFER
    assert balance.reserved == 1
    assert "restoreOrder" not in seller_allowed_actions(order)
    with pytest.raises(DomainError) as error:
        restore_order(
            context=context,
            order_id=order.public_id,
            idempotency_key="restore-reissued",
        )
    assert error.value.code == "ORDER_TRANSITION_NOT_ALLOWED"


def test_send_offer_link_enqueues_product_offer_template() -> None:
    _user, context = identity("deposit-email@example.com")
    order, _product = offer_order(context)
    send_offer_link(
        context=context,
        order_id=order.public_id,
        email="comprador@example.cl",
        idempotency_key="offer-mail",
    )
    event = OutboxEvent.objects.get(
        event_type="sales.order_notification",
        aggregate_public_id=str(order.public_id),
    )
    assert event.payload["template"] == "product_offer_link"
    assert event.payload["recipient"] == "comprador@example.cl"

    rendered = render_email(
        "product_offer_link",
        {
            "actionUrl": "https://shop.test/p/token",
            "productName": "Vela depósito",
            "total": "5000",
            "expiresAt": "10 sept 2026",
            "orderNumber": order.number,
        },
    )
    assert rendered.subject == f"Tenda · Pedido {order.number}: completa el pago"
    assert "Abrir pedido y subir comprobante" in rendered.html
    assert "Vela depósito" in rendered.html


def test_public_order_exposes_photos_and_media_route() -> None:
    fake_object_storage.clear()
    _user, context = identity("deposit-media@example.com")
    order, product = offer_order(context)
    buffer = io.BytesIO()
    Image.new("RGB", (48, 48), (20, 80, 40)).save(buffer, format="PNG")
    content = buffer.getvalue()
    prepared = prepare_upload(
        context=context,
        purpose=MediaAsset.Purpose.PRODUCT_IMAGE,
        original_name="frente.png",
        content_type="image/png",
        size=len(content),
    )
    fake_object_storage.write_bytes(
        key=prepared.asset.object_key,
        content=content,
        content_type="image/png",
    )
    asset = complete_upload(context=context, public_id=prepared.asset.public_id)
    attach_product_media(
        context=context,
        product_id=product.public_id,
        asset_id=asset.public_id,
    )
    token = decrypt_credential(order.public_token_ciphertext)
    response = Client().get(f"/api/v1/public/orders/{token}/media/{asset.public_id}")
    assert response.status_code == 200
    assert response.content
    payload = Client().post(
        "/graphql/",
        data=json.dumps(
            {
                "query": """
                query ($token: String!) {
                  publicOrder(token: $token) {
                    lines { photos imageUrl }
                  }
                }
                """,
                "variables": {"token": token},
            }
        ),
        content_type="application/json",
    ).json()
    assert "errors" not in payload, payload.get("errors")
    line = payload["data"]["publicOrder"]["lines"][0]
    assert line["photos"]
    assert str(asset.public_id) in line["photos"][0]
    assert line["imageUrl"] == line["photos"][0]


def test_public_order_exposes_seller_logo() -> None:
    fake_object_storage.clear()
    _user, context = identity("deposit-logo@example.com")
    order, _product = offer_order(context)
    buffer = io.BytesIO()
    Image.new("RGB", (64, 64), (20, 80, 40)).save(buffer, format="PNG")
    content = buffer.getvalue()
    prepared = prepare_upload(
        context=context,
        purpose=MediaAsset.Purpose.ORGANISATION_LOGO,
        original_name="logo.png",
        content_type="image/png",
        size=len(content),
    )
    fake_object_storage.write_bytes(
        key=prepared.asset.object_key,
        content=content,
        content_type="image/png",
    )
    asset = complete_upload(context=context, public_id=prepared.asset.public_id)
    context.organisation.logo_asset_id = asset.public_id
    context.organisation.save(update_fields=("logo_asset_id", "updated_at"))
    token = decrypt_credential(order.public_token_ciphertext)
    payload = Client().post(
        "/graphql/",
        data=json.dumps(
            {
                "query": """
                query ($token: String!) {
                  publicOrder(token: $token) {
                    seller { name logoUrl }
                  }
                }
                """,
                "variables": {"token": token},
            }
        ),
        content_type="application/json",
    ).json()
    assert "errors" not in payload, payload.get("errors")
    seller = payload["data"]["publicOrder"]["seller"]
    assert seller["logoUrl"]
    assert str(asset.public_id) in seller["logoUrl"]
    response = Client().get(f"/api/v1/public/orders/{token}/media/{asset.public_id}")
    assert response.status_code == 200
    assert response.content


def test_create_order_requires_bank_details_for_deposit() -> None:
    user = User.objects.create_user(
        email="no-bank@example.com",
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name="Sin banco")
    context = resolve_tenant_context(user)
    product = create_product(
        context=context,
        name="Vela",
        purchase_price="400",
        sale_price="5000",
        initial_quantity=1,
    ).product
    with pytest.raises(DomainError) as error:
        create_order(
            context=context,
            lines=[
                {
                    "productId": str(product.public_id),
                    "quantity": 1,
                    "unitSalePrice": "5000",
                }
            ],
            delivery_mode=Order.DeliveryMode.COORDINATED,
            payment_method=Order.PaymentMethod.BANK_TRANSFER,
            idempotency_key="no-bank",
        )
    assert error.value.code == "BANK_DETAILS_REQUIRED"
    assert "datos bancarios" in error.value.message


def test_public_order_exposes_structured_bank_details() -> None:
    _user, context = identity("deposit-bank@example.com")
    order, _product = offer_order(context)
    token = decrypt_credential(order.public_token_ciphertext)
    payload = Client().post(
        "/graphql/",
        data=json.dumps(
            {
                "query": """
                query ($token: String!) {
                  publicOrder(token: $token) {
                    bankTransferInstructions
                    bankDetails {
                      bankName
                      accountType
                      accountTypeLabel
                      accountNumber
                      taxId
                      confirmationEmail
                    }
                  }
                }
                """,
                "variables": {"token": token},
            }
        ),
        content_type="application/json",
    ).json()
    assert "errors" not in payload, payload.get("errors")
    public = payload["data"]["publicOrder"]
    assert public["bankDetails"] == {
        "bankName": "BancoEstado",
        "accountType": "cuenta_corriente",
        "accountTypeLabel": "Cuenta corriente",
        "accountNumber": "12345678",
        "taxId": "11.111.111-1",
        "confirmationEmail": "pagos@example.com",
    }
    assert "BancoEstado" in public["bankTransferInstructions"]
    assert "12345678" in public["bankTransferInstructions"]
