from __future__ import annotations

import json
import logging

import pytest
from django.test import Client, override_settings

from apps.configuration.models import EncryptedCredential
from apps.configuration.services import credential_secret, store_credential
from apps.organisations.services import create_organisation_for_owner
from apps.users.models import User
from tenda.observability import RedactingJsonFormatter, scrub_sentry_event

pytestmark = pytest.mark.django_db(transaction=True)
TEST_STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


def organisation_for(email: str):
    user = User.objects.create_user(
        email=email,
        password="Correct-Horse-Battery-42",
    )
    return create_organisation_for_owner(owner=user, name=email).organisation


def test_structured_logs_redact_pii_credentials_and_tokens() -> None:
    record = logging.LogRecord(
        name="tenda.test",
        level=logging.ERROR,
        pathname=__file__,
        lineno=1,
        msg=("Login buyer@example.com Authorization=Bearer abc.def token=raw-token-value"),
        args=(),
        exc_info=None,
    )
    payload = json.loads(RedactingJsonFormatter().format(record))

    assert payload["message"] == ("Login [EMAIL] Authorization=[REDACTED] token=[REDACTED]")
    assert "buyer@example.com" not in json.dumps(payload)
    assert "raw-token-value" not in json.dumps(payload)


def test_security_headers_and_correlation_are_present() -> None:
    response = Client().get(
        "/health/live/",
        HTTP_X_CORRELATION_ID="security-request",
    )

    assert response.status_code == 200
    assert response["X-Correlation-ID"] == "security-request"
    assert "default-src 'self'" in response["Content-Security-Policy"]
    assert response["X-Content-Type-Options"] == "nosniff"
    assert "camera=()" in response["Permissions-Policy"]


def test_credentials_are_encrypted_rotatable_and_tenant_scoped() -> None:
    first_organisation = organisation_for("secret-one@example.com")
    second_organisation = organisation_for("secret-two@example.com")
    first = store_credential(
        organisation=first_organisation,
        provider="mercado_pago",
        secret="first-sensitive-access-token",
    )
    second = store_credential(
        organisation=first_organisation,
        provider="mercado_pago",
        secret="rotated-sensitive-access-token",
    )
    store_credential(
        organisation=second_organisation,
        provider="mercado_pago",
        secret="foreign-sensitive-access-token",
    )

    first.refresh_from_db()
    assert first.is_active is False
    assert second.is_active is True
    assert "rotated-sensitive-access-token" not in second.ciphertext
    assert (
        credential_secret(
            organisation=first_organisation,
            provider="mercado_pago",
        )
        == "rotated-sensitive-access-token"
    )
    assert (
        EncryptedCredential.objects.filter(
            organisation=first_organisation,
        ).count()
        == 2
    )


def test_sentry_scrubber_removes_default_pii() -> None:
    event = scrub_sentry_event(
        {
            "request": {
                "data": {
                    "email": "person@example.com",
                    "password": "not-for-sentry",
                },
                "url": "https://example.test/reset?token=sensitive",
            }
        },
        {},
    )

    serialized = json.dumps(event)
    assert "person@example.com" not in serialized
    assert "not-for-sentry" not in serialized
    assert "sensitive" not in serialized


@override_settings(
    ADMIN_ALLOWED_NETWORKS=["10.42.0.0/24"],
    STORAGES=TEST_STORAGES,
)
def test_admin_is_hidden_outside_the_operations_network() -> None:
    denied = Client().get("/admin/login/", REMOTE_ADDR="203.0.113.8")
    allowed = Client().get("/admin/login/", REMOTE_ADDR="10.42.0.10")

    assert denied.status_code == 404
    assert allowed.status_code == 200
    assert allowed["Cache-Control"] == "no-store"


@override_settings(
    ADMIN_ALLOWED_NETWORKS=[],
    AUTH_RATE_LIMITS={"admin_login": (1, 900, 900)},
    STORAGES=TEST_STORAGES,
)
def test_admin_login_has_durable_rate_limiting() -> None:
    client = Client()
    first = client.post(
        "/admin/login/",
        {"username": "support@example.com", "password": "invalid"},
        REMOTE_ADDR="10.42.0.10",
    )
    blocked = client.post(
        "/admin/login/",
        {"username": "support@example.com", "password": "invalid"},
        REMOTE_ADDR="10.42.0.10",
    )

    assert first.status_code == 200
    assert blocked.status_code == 429
    assert blocked["Retry-After"] == "900"
