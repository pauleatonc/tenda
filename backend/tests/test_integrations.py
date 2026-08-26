from __future__ import annotations

import hashlib
import hmac
import json
from decimal import Decimal

import pytest
from django.test import Client, override_settings
from django.utils import timezone

from apps.media_assets.models import MediaAsset
from apps.media_assets.services import (
    complete_upload,
    prepare_upload,
    private_download_url,
)
from apps.media_assets.storage import fake_object_storage
from apps.notifications.providers import EmailRequest, fake_email_provider
from apps.organisations.selectors import resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.sales.models import PaymentWebhookEvent
from apps.sales.payments import PaymentPreferenceInput, fake_payment_provider
from apps.users.models import User
from tenda.errors import DomainError

pytestmark = pytest.mark.django_db(transaction=True)


def context_for(email: str):
    user = User.objects.create_user(
        email=email,
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    return resolve_tenant_context(user)


def test_private_storage_fake_is_tenant_scoped_and_expiring() -> None:
    fake_object_storage.clear()
    owner = context_for("storage-owner@example.com")
    foreign = context_for("storage-foreign@example.com")
    prepared = prepare_upload(
        context=owner,
        purpose=MediaAsset.Purpose.PRODUCT_IMAGE,
        original_name="../../producto.webp",
        content_type="image/webp",
        size=2048,
    )

    completed = complete_upload(context=owner, public_id=prepared.asset.public_id)
    download_url = private_download_url(
        context=owner,
        public_id=prepared.asset.public_id,
    )

    assert str(owner.organisation.public_id) in prepared.asset.object_key
    assert prepared.asset.object_key.endswith(".webp")
    assert completed.status == MediaAsset.Status.READY
    assert "expires=300" in download_url
    assert not hasattr(completed, "public_url")
    with pytest.raises(DomainError):
        private_download_url(
            context=foreign,
            public_id=prepared.asset.public_id,
        )


def test_fake_email_and_payment_providers_are_deterministic() -> None:
    fake_email_provider.clear()
    email = EmailRequest(
        recipient="buyer@example.com",
        template="order_paid",
        parameters={"order": "123"},
        idempotency_key="email-key",
    )
    first_email = fake_email_provider.send(email)
    second_email = fake_email_provider.send(email)
    payment_input = PaymentPreferenceInput(
        external_reference="order-123",
        title="Pedido 123",
        amount=Decimal("12990"),
        currency="CLP",
        payer_email="buyer@example.com",
        success_url="https://example.test/success",
        pending_url="https://example.test/pending",
        failure_url="https://example.test/failure",
        notification_url="https://example.test/webhook",
    )
    first_payment = fake_payment_provider.create_preference(
        payment_input,
        idempotency_key="payment-key",
    )
    second_payment = fake_payment_provider.create_preference(
        payment_input,
        idempotency_key="payment-key",
    )

    assert first_email == second_email
    assert len(fake_email_provider.messages()) == 1
    assert first_payment == second_payment
    assert first_payment.checkout_url.startswith("https://payments.invalid/")


def test_fake_payment_webhook_is_signed_durable_and_idempotent() -> None:
    client = Client(enforce_csrf_checks=True)
    payload = {"id": "event-001", "type": "payment", "data": {"id": "payment-01"}}
    invalid = client.post(
        "/api/v1/webhooks/mercado-pago",
        data=json.dumps(payload),
        content_type="application/json",
        HTTP_X_SIGNATURE="invalid",
    )
    first = client.post(
        "/api/v1/webhooks/mercado-pago",
        data=json.dumps(payload),
        content_type="application/json",
        HTTP_X_SIGNATURE="fake-valid",
        HTTP_X_REQUEST_ID="provider-request-1",
    )
    duplicate = client.post(
        "/api/v1/webhooks/mercado-pago",
        data=json.dumps(payload),
        content_type="application/json",
        HTTP_X_SIGNATURE="fake-valid",
        HTTP_X_REQUEST_ID="provider-request-1",
    )

    assert invalid.status_code == 401
    assert first.status_code == duplicate.status_code == 200
    assert first.json()["data"]["duplicate"] is False
    assert duplicate.json()["data"]["duplicate"] is True
    event = PaymentWebhookEvent.objects.get()
    assert event.signature_valid
    assert "signature" not in json.dumps(event.safe_headers).lower()


@override_settings(
    PAYMENT_PROVIDER="mercado_pago",
    MERCADO_PAGO_WEBHOOK_SECRET="webhook-secret",
)
def test_mercado_pago_signature_contract() -> None:
    payload = {"id": 44, "type": "payment", "data": {"id": "ABC-123"}}
    timestamp = "1700000000"
    request_id = "request-9"
    manifest = f"id:abc-123;request-id:{request_id};ts:{timestamp};"
    signature = hmac.new(
        b"webhook-secret",
        manifest.encode(),
        hashlib.sha256,
    ).hexdigest()
    response = Client().post(
        "/api/v1/webhooks/mercado-pago?data.id=ABC-123",
        data=json.dumps(payload),
        content_type="application/json",
        HTTP_X_SIGNATURE=f"ts={timestamp},v1={signature}",
        HTTP_X_REQUEST_ID=request_id,
    )

    assert response.status_code == 200
    event = PaymentWebhookEvent.objects.get()
    assert event.provider_event_id == "44"
    assert event.normalized_payload["resourceId"] == "ABC-123"
