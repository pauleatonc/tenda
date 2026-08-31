from __future__ import annotations

import hashlib
import hmac
import json
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from django.test import Client, override_settings
from django.utils import timezone

from apps.media_assets.keys import build_object_key, r2_object_key
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import (
    complete_upload,
    prepare_upload,
    private_download_url,
)
from apps.media_assets.storage import LocalFileObjectStorage, fake_object_storage
from apps.notifications.email_templates import render_email
from apps.notifications.providers import (
    BrevoEmailProvider,
    EmailRequest,
    fake_email_provider,
)
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
    assert "/media/product_image/" in prepared.asset.object_key
    assert prepared.asset.object_key.endswith(".webp")
    assert completed.status == MediaAsset.Status.READY
    assert "expires=300" in download_url
    assert not hasattr(completed, "public_url")
    with pytest.raises(DomainError):
        private_download_url(
            context=foreign,
            public_id=prepared.asset.public_id,
        )


def test_local_file_storage_writes_under_media_root(tmp_path) -> None:
    storage = LocalFileObjectStorage(root=tmp_path)
    key = "organisations/org-1/media/product_image/asset.webp"
    storage.write_bytes(key=key, content=b"webp-bytes", content_type="image/webp")

    assert (tmp_path / key).read_bytes() == b"webp-bytes"
    stored = storage.head(key=key)
    assert stored.content_type == "image/webp"
    assert stored.size == 10


def test_object_keys_group_media_and_documents() -> None:
    media = build_object_key(
        organisation_id="org-1",
        purpose=MediaAsset.Purpose.PRODUCT_IMAGE,
        public_id="asset-1",
        original_name="foto.webp",
    )
    receipt = build_object_key(
        organisation_id="org-1",
        purpose=MediaAsset.Purpose.PAYMENT_RECEIPT,
        public_id="asset-2",
        original_name="boleta.pdf",
        extra="order-9",
    )

    assert media == "organisations/org-1/media/product_image/asset-1.webp"
    assert receipt == (
        "organisations/org-1/documents/payment_receipt/order-9/asset-2.pdf"
    )


@override_settings(R2_PREFIX="dev")
def test_r2_prefix_is_environment_folder() -> None:
    assert r2_object_key("organisations/org/media/product_image/a.webp") == (
        "dev/organisations/org/media/product_image/a.webp"
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


def test_app_email_templates_render_verify_and_reset_links() -> None:
    verify = render_email(
        "verify_email",
        {
            "actionUrl": "https://app.test/verificar-email?token=abc",
            "expiresAt": "2026-08-31T12:00:00+00:00",
        },
    )
    reset = render_email(
        "reset_password",
        {"actionUrl": "https://app.test/recuperar?token=xyz"},
    )

    assert "Verifica tu correo" in verify.subject
    assert "https://app.test/verificar-email?token=abc" in verify.html
    assert "https://app.test/recuperar?token=xyz" in reset.html
    assert "templateId" not in verify.html


@override_settings(
    BREVO_API_KEY="test-key",
    BREVO_SENDER_EMAIL="hola@tenda.test",
    BREVO_SENDER_NAME="Tenda",
)
def test_brevo_sends_app_html_without_template_id() -> None:
    captured: dict = {}

    def fake_post(url: str, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        response = MagicMock()
        response.raise_for_status = lambda: None
        response.json.return_value = {"messageId": "msg-1"}
        return response

    with patch("apps.notifications.providers.httpx.post", side_effect=fake_post):
        result = BrevoEmailProvider().send(
            EmailRequest(
                recipient="user@example.com",
                template="verify_email",
                parameters={"actionUrl": "https://app.test/verificar-email?token=abc"},
                idempotency_key="verify-1",
            )
        )

    body = captured["json"]
    assert result.message_id == "msg-1"
    assert "templateId" not in body
    assert body["subject"] == "Verifica tu correo en Tenda"
    assert "https://app.test/verificar-email?token=abc" in body["htmlContent"]
    assert "https://app.test/verificar-email?token=abc" in body["textContent"]


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
