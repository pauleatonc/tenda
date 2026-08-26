from __future__ import annotations

import hashlib
import json
from urllib.parse import parse_qs, urlparse

import pytest
from django.test import Client, override_settings
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.configuration.models import FeatureFlag, OperationalParameter
from apps.organisations.models import Membership
from apps.organisations.selectors import resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.sales.models import PaymentOAuthState, SellerPaymentConnection
from apps.sales.services import (
    complete_seller_payment_connection,
    payment_commission_configuration,
    seller_access_token,
    start_seller_payment_connection,
)
from apps.users.models import User
from tenda.errors import DomainError

pytestmark = pytest.mark.django_db(transaction=True)


def identity(
    email: str,
    *,
    role: str = Membership.Role.OWNER,
):
    user = User.objects.create_user(
        email=email,
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    provision = create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    provision.membership.role = role
    provision.membership.manage_sensitive_configuration = role == Membership.Role.OWNER
    provision.membership.save(
        update_fields=("role", "manage_sensitive_configuration"),
    )
    return user, resolve_tenant_context(user)


def post_json(client: Client, path: str, payload: dict[str, object]):
    return client.post(
        path,
        data=json.dumps(payload),
        content_type="application/json",
    )


@override_settings(
    PAYMENT_PROVIDER="fake",
    CREDENTIAL_ENCRYPTION_KEY="payment-test-key",
)
def test_oauth_state_is_one_use_and_seller_tokens_are_encrypted() -> None:
    _owner, context = identity("payment-owner@example.com")

    started = start_seller_payment_connection(
        context=context,
        correlation_id="payment-correlation",
    )
    raw_state = parse_qs(urlparse(started.authorization_url).query)["state"][0]
    oauth_state = PaymentOAuthState.objects.get()
    pending = SellerPaymentConnection.objects.get()

    assert oauth_state.state_hash == hashlib.sha256(raw_state.encode()).hexdigest()
    assert raw_state not in oauth_state.state_hash
    assert pending.status == SellerPaymentConnection.Status.PENDING

    connected = complete_seller_payment_connection(
        state=raw_state,
        code="seller-authorisation-code",
        correlation_id="payment-correlation",
    )

    assert connected.status == SellerPaymentConnection.Status.CONNECTED
    assert "fake-access" not in connected.access_token_ciphertext
    assert "fake-refresh" not in connected.refresh_token_ciphertext
    assert seller_access_token(connected).startswith("fake-access-")
    assert set(
        AuditEvent.objects.values_list("action", flat=True),
    ) >= {
        "payments.connection_started",
        "payments.connection_completed",
    }
    with pytest.raises(DomainError) as replay:
        complete_seller_payment_connection(
            state=raw_state,
            code="seller-authorisation-code",
        )
    assert replay.value.code == "PAYMENT_OAUTH_STATE_INVALID"


@override_settings(
    PAYMENT_PROVIDER="fake",
    CREDENTIAL_ENCRYPTION_KEY="payment-test-key",
    WEB_ORIGIN="https://app.example.test",
)
def test_graphql_connection_contract_never_exposes_tokens() -> None:
    owner, _context = identity("payment-graphql@example.com")
    client = Client()
    login = post_json(
        client,
        "/api/v1/auth/login",
        {"email": owner.email, "password": "Correct-Horse-Battery-42"},
    )
    assert login.status_code == 200

    started = post_json(
        client,
        "/graphql/",
        {
            "query": """
                mutation {
                  startMercadoPagoConnection {
                    connection { authorizationUrl expiresAt }
                  }
                }
            """,
        },
    )
    authorization_url = started.json()["data"]["startMercadoPagoConnection"]["connection"][
        "authorizationUrl"
    ]
    state = parse_qs(urlparse(authorization_url).query)["state"][0]
    callback = client.get(
        "/api/v1/integrations/mercado-pago/callback",
        {"state": state, "code": "graphql-code"},
    )
    query = post_json(
        client,
        "/graphql/",
        {
            "query": """
                query {
                  sellerPaymentConnection {
                    id provider status providerAccountId scopes tokenExpiresAt
                  }
                  paymentCommissionConfiguration {
                    mode rate minimum zeroFeeEnabled
                  }
                }
            """,
        },
    )
    serialized = json.dumps(query.json()).lower()

    assert callback.status_code == 302
    assert (
        callback.headers["Location"]
        == "https://app.example.test/app/configuracion?paymentConnection=connected"
    )
    assert query.json()["data"]["sellerPaymentConnection"]["status"] == "connected"
    assert "access_token" not in serialized
    assert "refresh_token" not in serialized
    assert "ciphertext" not in serialized

    disconnected = post_json(
        client,
        "/graphql/",
        {"query": "mutation { disconnectMercadoPagoConnection { connection { status } } }"},
    )
    connection = SellerPaymentConnection.objects.get()
    assert (
        disconnected.json()["data"]["disconnectMercadoPagoConnection"]["connection"]["status"]
        == "disconnected"
    )
    assert connection.access_token_ciphertext == ""
    assert connection.refresh_token_ciphertext == ""


@override_settings(
    MERCADO_PAGO_COMMISSION_MODE="disabled",
    MERCADO_PAGO_COMMISSION_RATE="0",
    MERCADO_PAGO_COMMISSION_MINIMUM="0",
)
def test_commission_parameters_and_zero_fee_flag_support_tenant_override() -> None:
    owner, context = identity("payment-config@example.com")
    OperationalParameter.objects.create(
        organisation=context.organisation,
        key="commission_mode",
        value="percentage",
        updated_by=owner,
    )
    OperationalParameter.objects.create(
        organisation=context.organisation,
        key="commission_rate",
        value="2.5",
        updated_by=owner,
    )
    OperationalParameter.objects.create(
        organisation=context.organisation,
        key="commission_minimum",
        value=100,
        updated_by=owner,
    )
    FeatureFlag.objects.create(
        organisation=context.organisation,
        key="mercado_pago_zero_fee",
        enabled=True,
        updated_by=owner,
    )

    configuration = payment_commission_configuration(context)

    assert configuration.mode.value == "percentage"
    assert str(configuration.rate) == "2.5"
    assert configuration.minimum == 100
    assert configuration.zero_fee_enabled


@override_settings(PAYMENT_PROVIDER="fake")
def test_operator_cannot_manage_or_read_payment_connection() -> None:
    _operator, context = identity(
        "payment-operator@example.com",
        role=Membership.Role.OPERATOR,
    )

    with pytest.raises(DomainError) as denied:
        start_seller_payment_connection(context=context)

    assert denied.value.code == "PERMISSION_DENIED"
