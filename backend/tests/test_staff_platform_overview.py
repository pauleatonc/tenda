from __future__ import annotations

import json
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.billing.models import OrganisationSubscription, Plan
from apps.inventory.services import create_product
from apps.organisations.models import Membership
from apps.organisations.selectors import resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.platform.overview import staff_platform_overview
from apps.sales.models import Order
from apps.users.models import User

pytestmark = pytest.mark.django_db(transaction=True)


def _owner(email: str) -> tuple[User, object]:
    user = User.objects.create_user(
        email=email,
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    return user, resolve_tenant_context(user)


def test_staff_overview_counts_plans_products_and_sales() -> None:
    _free_user, free_context = _owner("staff-free@example.com")
    paid_user, paid_context = _owner("staff-paid@example.com")
    starter = Plan.objects.get(code="starter")
    OrganisationSubscription.objects.update_or_create(
        organisation=paid_context.organisation,
        defaults={
            "plan": starter,
            "status": OrganisationSubscription.Status.ACTIVE,
            "cancel_at_period_end": False,
        },
    )
    create_product(
        context=paid_context,
        name="Mesa",
        purchase_price=1000,
        sale_price=2500,
        initial_quantity=4,
    )
    now = timezone.now()
    Order.objects.create(
        organisation=paid_context.organisation,
        inventory=paid_context.inventory,
        number="T-1",
        status=Order.Status.PAID,
        delivery_mode=Order.DeliveryMode.PICKUP,
        payment_method=Order.PaymentMethod.CASH,
        total_amount=2500,
        reservation_expires_at=now,
        paid_at=now,
        public_token_hash="a" * 64,
        public_token_ciphertext="token",
        public_token_expires_at=now + timedelta(days=1),
        created_by=paid_user,
    )

    overview = staff_platform_overview()

    by_code = {plan.code: plan.organisation_count for plan in overview.plans}
    assert overview.organisation_count == 2
    assert by_code["free"] == 1
    assert by_code["starter"] == 1
    assert by_code["growth"] == 0
    assert overview.active_product_count == 1
    assert overview.inventory_units == 4
    assert overview.inventory_at_cost == 4000
    assert overview.inventory_at_sale_price == 10000
    assert overview.confirmed_sales_count == 1
    assert overview.confirmed_sales_amount == 2500
    assert overview.net_sales_amount == 2500
    assert free_context.organisation.pk != paid_context.organisation.pk


def test_platform_overview_is_staff_only() -> None:
    user, _context = _owner("staff-denied@example.com")
    assert user.is_staff is False
    client = Client()
    login = client.post(
        "/api/v1/auth/login",
        data=json.dumps({"email": user.email, "password": "Correct-Horse-Battery-42"}),
        content_type="application/json",
    )
    assert login.status_code == 200
    assert login.json()["data"]["viewer"]["isStaff"] is False

    denied = client.post(
        "/graphql/",
        data=json.dumps({"query": "{ staffPlatformOverview { organisationCount } }"}),
        content_type="application/json",
    )
    assert denied.json()["errors"][0]["extensions"]["code"] == "PERMISSION_DENIED"

    user.is_staff = True
    user.save(update_fields=["is_staff"])
    client.force_login(user)
    allowed = client.post(
        "/graphql/",
        data=json.dumps(
            {
                "query": (
                    "{ staffPlatformOverview { organisationCount "
                    "plans { code organisationCount } } }"
                )
            }
        ),
        content_type="application/json",
    )
    body = allowed.json()
    assert "errors" not in body
    assert body["data"]["staffPlatformOverview"]["organisationCount"] == 1
    assert Membership.objects.filter(user=user).exists()
