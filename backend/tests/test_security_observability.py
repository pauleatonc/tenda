from __future__ import annotations

import json
import logging

import pytest
from django.test import Client, override_settings

from tenda.observability import RedactingJsonFormatter, scrub_sentry_event

pytestmark = pytest.mark.django_db(transaction=True)
TEST_STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


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
