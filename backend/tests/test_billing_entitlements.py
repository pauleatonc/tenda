from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.billing.entitlements import (
    assert_ai_assisted_allowed,
    assert_can_create_product,
    get_organisation_entitlements,
)
from apps.billing.models import OrganisationSubscription, Plan
from apps.billing.provider import (
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
