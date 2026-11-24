from __future__ import annotations

import json
import logging
from datetime import timedelta
from email.message import Message
from io import BytesIO
from urllib import error, request

import pytest
from django.test import override_settings
from django.utils import timezone

from apps.billing.entitlements import (
    assert_ai_assisted_allowed,
    assert_can_create_product,
    get_organisation_entitlements,
)
from apps.billing.models import OrganisationSubscription, Plan
from apps.billing.provider import (
    MercadoPagoBillingProvider,
    PreapprovalSnapshot,
    get_billing_provider,
    reset_fake_billing_provider,
)
from apps.billing.services import start_plan_checkout, sync_subscription_from_provider
from apps.inventory.services import archive_product, create_product
from apps.organisations.models import Membership
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.users.models import User
from tenda.errors import DomainError
from tenda.observability import RedactingJsonFormatter

pytestmark = pytest.mark.django_db(transaction=True)


def identity(email: str) -> tuple[User, TenantContext]:
    user = User.objects.create_user(
        email=email,
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    return user, resolve_tenant_context(user)


def activate_plan(context: TenantContext, code: str) -> OrganisationSubscription:
    plan = Plan.objects.get(code=code)
    subscription, _ = OrganisationSubscription.objects.update_or_create(
        organisation=context.organisation,
        defaults={
            "plan": plan,
            "status": OrganisationSubscription.Status.ACTIVE,
            "mp_preapproval_id": f"sub-{code}",
            "cancel_at_period_end": False,
            "past_due_since": None,
            "current_period_end": timezone.now() + timedelta(days=30),
        },
    )
    return subscription


def test_free_plan_blocks_sixth_product_and_ai() -> None:
    _user, context = identity("billing-free@example.com")
    for index in range(5):
        create_product(context=context, name=f"Producto {index}")

    with pytest.raises(DomainError) as overflow:
        create_product(context=context, name="Producto 6")
    assert overflow.value.code == "PRODUCT_LIMIT_REACHED"

    with pytest.raises(DomainError) as ai:
        assert_ai_assisted_allowed(context.organisation)
    assert ai.value.code == "AI_FEATURE_REQUIRES_PLAN"

    entitlements = get_organisation_entitlements(context.organisation)
    assert entitlements.plan_code == "free"
    assert entitlements.product_count == 5
    assert entitlements.remaining_slots == 0


def test_starter_allows_ai_and_fifteen_products() -> None:
    _user, context = identity("billing-starter@example.com")
    activate_plan(context, "starter")
    assert_ai_assisted_allowed(context.organisation)
    for index in range(15):
        create_product(context=context, name=f"Starter {index}")
    with pytest.raises(DomainError) as overflow:
        create_product(context=context, name="Starter overflow")
    assert overflow.value.code == "PRODUCT_LIMIT_REACHED"


def test_archiving_frees_slot_on_free_plan() -> None:
    _user, context = identity("billing-archive@example.com")
    products = [create_product(context=context, name=f"Item {index}").product for index in range(5)]
    with pytest.raises(DomainError):
        create_product(context=context, name="Extra")
    archive_product(context=context, product_id=products[0].public_id)
    assert_can_create_product(context.organisation)
    create_product(context=context, name="Extra")


def test_register_defers_plan_selection() -> None:
    import json

    from django.test import Client

    from apps.billing.services import organisation_needs_plan_selection, select_signup_plan
    from apps.organisations.models import Membership
    from apps.users.models import User

    client = Client()
    response = client.post(
        "/api/v1/auth/register",
        data=json.dumps(
            {
                "email": "plan-intent@example.com",
                "password": "Correct-Horse-Battery-42",
                "fullName": "Plan Intent",
                "acceptedTerms": True,
                "planCode": "starter",
                "turnstileToken": "local-development",
            }
        ),
        content_type="application/json",
    )
    assert response.status_code == 202
    user = User.objects.get(email="plan-intent@example.com")
    membership = Membership.objects.get(user=user)
    assert not OrganisationSubscription.objects.filter(
        organisation=membership.organisation
    ).exists()
    assert organisation_needs_plan_selection(membership.organisation) is True

    context = resolve_tenant_context(user)
    with pytest.raises(DomainError) as blocked:
        select_signup_plan(context=context, plan_code="free", accepted_terms=False)
    assert blocked.value.code == "TERMS_NOT_ACCEPTED"

    overview = select_signup_plan(
        context=context,
        plan_code="free",
        accepted_terms=True,
    )
    assert overview.entitlements.plan_code == "free"
    assert organisation_needs_plan_selection(membership.organisation) is False
    subscription = OrganisationSubscription.objects.get(organisation=membership.organisation)
    assert subscription.plan.code == "free"
    assert subscription.status == OrganisationSubscription.Status.ACTIVE
    checkout = start_plan_checkout(
        context=context,
        plan_code="starter",
        accepted_terms=False,
    )
    assert checkout.plan_code == "starter"


def test_cancel_subscription_returns_to_free_immediately() -> None:
    from apps.billing.services import cancel_subscription

    provider = reset_fake_billing_provider()
    _user, context = identity("billing-cancel@example.com")
    subscription = activate_plan(context, "growth")
    provider.set_preapproval(
        PreapprovalSnapshot(
            provider_id=subscription.mp_preapproval_id,
            status="authorized",
            init_point="https://billing.invalid/growth",
            external_reference="tenda-billing:1:growth",
            preapproval_plan_id="seed-growth",
            payer_email="billing-cancel@example.com",
        )
    )

    cancel_subscription(context=context)

    entitlements = get_organisation_entitlements(context.organisation)
    assert entitlements.plan_code == "free"
    assert entitlements.product_limit == 5
    assert entitlements.ai_assisted_enabled is False
    assert entitlements.cancel_at_period_end is False
    subscription.refresh_from_db()
    assert subscription.plan.code == "free"
    assert subscription.status == OrganisationSubscription.Status.ACTIVE
    assert subscription.mp_preapproval_id == ""
    assert provider.get_preapproval("sub-growth").status == "cancelled"

    with pytest.raises(DomainError) as again:
        cancel_subscription(context=context)
    assert again.value.code == "NO_ACTIVE_SUBSCRIPTION"


def test_checkout_and_webhook_activate_subscription() -> None:
    provider = reset_fake_billing_provider()
    user, context = identity("billing-checkout@example.com")
    assert context.membership.role == Membership.Role.OWNER
    with pytest.raises(DomainError) as blocked:
        start_plan_checkout(context=context, plan_code="starter", accepted_terms=False)
    assert blocked.value.code == "TERMS_NOT_ACCEPTED"
    checkout = start_plan_checkout(
        context=context,
        plan_code="starter",
        accepted_terms=True,
    )
    assert checkout.init_point.startswith("https://billing.invalid/")
    assert checkout.plan_code == "starter"

    subscription = OrganisationSubscription.objects.get(organisation=context.organisation)
    current = provider.get_preapproval(subscription.mp_preapproval_id)
    provider.set_preapproval(
        PreapprovalSnapshot(
            provider_id=current.provider_id,
            status="authorized",
            init_point=current.init_point,
            external_reference=current.external_reference,
            preapproval_plan_id=current.preapproval_plan_id,
            payer_email=user.email,
            next_payment_date=(timezone.now() + timedelta(days=30)).isoformat(),
        )
    )
    assert get_billing_provider() is provider
    synced = sync_subscription_from_provider(subscription.mp_preapproval_id)
    assert synced is not None
    assert synced.status == OrganisationSubscription.Status.ACTIVE
    entitlements = get_organisation_entitlements(context.organisation)
    assert entitlements.plan_code == "starter"
    assert entitlements.ai_assisted_enabled is True


def test_billing_rejection_logs_provider_body_without_secrets(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    raw = json.dumps(
        {
            "message": "preapproval_plan_id not found",
            "error": "bad_request",
            "status": 400,
            "payer_email": "buyer@example.com",
        }
    ).encode()

    def urlopen(req: object, timeout: int = 30) -> object:
        del req, timeout
        raise error.HTTPError(
            "https://api.mercadopago.com/preapproval",
            400,
            "Bad Request",
            Message(),
            BytesIO(raw),
        )

    monkeypatch.setattr("apps.billing.provider.request.urlopen", urlopen)
    with (
        override_settings(MERCADO_PAGO_BILLING_ACCESS_TOKEN="APP_USR-billing-secret"),
        caplog.at_level(logging.WARNING, logger="apps.billing.provider"),
        pytest.raises(DomainError) as caught,
    ):
        MercadoPagoBillingProvider().create_preapproval(
            reason="Tenda Starter",
            amount_clp=4990,
            payer_email="buyer@example.com",
            external_reference="tenda-billing:org:starter",
            back_url="https://tenda-app.com/app/configuracion/plan",
        )

    assert caught.value.code == "BILLING_PROVIDER_ERROR"
    formatted = RedactingJsonFormatter().format(caplog.records[-1])
    assert "billing_provider_rejected" in formatted
    assert "preapproval_plan_id not found" in formatted
    assert "Tenda Starter" in formatted
    assert "4990" in formatted
    assert "buyer@example.com" not in formatted
    assert "APP_USR-billing-secret" not in formatted


def test_pending_checkout_lets_mercado_pago_collect_the_card(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    class Response:
        def __enter__(self) -> Response:
            return self

        def __exit__(self, *args: object) -> bool:
            return False

        def read(self) -> bytes:
            return json.dumps(
                {
                    "id": "pre-1",
                    "status": "pending",
                    "init_point": "https://www.mercadopago.cl/subscriptions/checkout?preapproval_id=pre-1",
                    "external_reference": "tenda-billing:org:starter",
                }
            ).encode()

    def urlopen(req: request.Request, timeout: int = 30) -> Response:
        del timeout
        payload = req.data
        assert isinstance(payload, bytes)
        captured["body"] = json.loads(payload.decode())
        return Response()

    monkeypatch.setattr("apps.billing.provider.request.urlopen", urlopen)
    with override_settings(MERCADO_PAGO_BILLING_ACCESS_TOKEN="APP_USR-billing-secret"):
        snapshot = MercadoPagoBillingProvider().create_preapproval(
            reason="Tenda Starter",
            amount_clp=4990,
            payer_email="buyer@example.com",
            external_reference="tenda-billing:org:starter",
            back_url="https://tenda-app.com/app/configuracion/plan",
        )

    body = captured["body"]
    assert isinstance(body, dict)
    assert "preapproval_plan_id" not in body
    assert "card_token_id" not in body
    assert body["status"] == "pending"
    assert body["auto_recurring"] == {
        "frequency": 1,
        "frequency_type": "months",
        "transaction_amount": 4990,
        "currency_id": "CLP",
    }
    assert snapshot.init_point.startswith("https://www.mercadopago.cl/")
    assert snapshot.provider_id == "pre-1"
