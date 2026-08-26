from __future__ import annotations

import json

import pytest
from django.test import Client, override_settings
from django.utils import timezone

from apps.audit.idempotency import execute_idempotent
from apps.audit.models import IdempotencyKey
from apps.notifications.models import ContactRequest
from apps.organisations.selectors import resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.users.models import User
from tenda.errors import DomainError

pytestmark = pytest.mark.django_db(transaction=True)


def tenant_context():
    user = User.objects.create_user(
        email="idempotency@example.com",
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name="Negocio idempotente")
    return resolve_tenant_context(user)


def test_idempotency_replays_result_and_rejects_payload_mismatch() -> None:
    context = tenant_context()
    executions = 0

    def command() -> tuple[dict[str, object], int]:
        nonlocal executions
        executions += 1
        return {"created": True, "sequence": executions}, 201

    first = execute_idempotent(
        context=context,
        scope="test.create",
        key="stable-key",
        request_payload={"name": "Producto"},
        command=command,
    )
    replay = execute_idempotent(
        context=context,
        scope="test.create",
        key="stable-key",
        request_payload={"name": "Producto"},
        command=command,
    )

    assert first.status == replay.status == 201
    assert first.replayed is False
    assert replay.replayed is True
    assert replay.payload == first.payload
    assert executions == 1
    assert IdempotencyKey.objects.count() == 1

    with pytest.raises(DomainError) as error:
        execute_idempotent(
            context=context,
            scope="test.create",
            key="stable-key",
            request_payload={"name": "Otro producto"},
            command=command,
        )
    assert error.value.code == "IDEMPOTENCY_KEY_REUSED"


@override_settings(GRAPHQL_MAX_DEPTH=2)
def test_graphql_depth_limit_has_stable_error_and_correlation_id() -> None:
    response = Client().post(
        "/graphql/",
        data=json.dumps({"query": "{ viewer { profile { fullName } } }"}),
        content_type="application/json",
        HTTP_X_CORRELATION_ID="contract-test-request",
    )

    payload = response.json()
    assert response.status_code == 400
    assert payload["errors"][0]["extensions"]["code"] == "QUERY_TOO_DEEP"
    assert payload["errors"][0]["extensions"]["correlationId"] == "contract-test-request"
    assert payload["errors"][0]["extensions"]["retryable"] is False


def test_rest_method_error_uses_stable_envelope() -> None:
    response = Client().get(
        "/api/v1/auth/login",
        HTTP_X_CORRELATION_ID="rest-contract-request",
    )

    assert response.status_code == 405
    assert response.json()["error"] == {
        "code": "METHOD_NOT_ALLOWED",
        "message": "Método no permitido.",
        "fieldErrors": {},
        "retryable": False,
        "correlationId": "rest-contract-request",
    }


def test_public_contact_requires_csrf_and_turnstile() -> None:
    client = Client(enforce_csrf_checks=True)
    payload = {
        "name": "Ana",
        "email": "ana@example.com",
        "message": "Quiero conocer Tenda para mi negocio.",
        "turnstileToken": "local-development",
    }
    blocked = client.post(
        "/api/v1/public/contact",
        data=json.dumps(payload),
        content_type="application/json",
    )
    csrf_response = client.get("/api/v1/auth/csrf")
    csrf_token = csrf_response.json()["data"]["csrfToken"]
    accepted = client.post(
        "/api/v1/public/contact",
        data=json.dumps(payload),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token,
    )

    assert blocked.status_code == 403
    assert accepted.status_code == 202
    assert accepted.json()["data"]["accepted"] is True
    assert ContactRequest.objects.filter(email="ana@example.com").count() == 1
