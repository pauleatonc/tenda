"""Effective plan entitlements for an organisation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from apps.inventory.models import Product
from apps.organisations.models import Organisation
from tenda.errors import DomainError

from .models import OrganisationSubscription, Plan


@dataclass(frozen=True, slots=True)
class OrganisationEntitlements:
    plan_code: str
    plan_name: str
    price_clp: int
    product_limit: int | None
    product_count: int
    ai_assisted_enabled: bool
    can_create_product: bool
    remaining_slots: int | None
    subscription_status: str
    cancel_at_period_end: bool
    current_period_end: object | None


def count_billable_products(organisation: Organisation) -> int:
    return (
        Product.objects.filter(inventory__organisation=organisation)
        .exclude(catalog_status=Product.CatalogStatus.ARCHIVED)
        .values("pk")
        .count()
    )


def free_plan() -> Plan:
    plan = Plan.objects.filter(code=Plan.Code.FREE, is_active=True).first()
    if plan is None:
        raise DomainError(
            "BILLING_NOT_CONFIGURED",
            "Los planes de facturación no están configurados.",
            status=503,
        )
    return plan


def _grace_days() -> int:
    return int(getattr(settings, "BILLING_PAST_DUE_GRACE_DAYS", 3))


def effective_plan(organisation: Organisation) -> tuple[Plan, OrganisationSubscription | None]:
    """Return the plan that should gate features right now."""

    subscription = (
        OrganisationSubscription.objects.select_related("plan")
        .filter(organisation=organisation)
        .first()
    )
    if subscription is None:
        return free_plan(), None

    now = timezone.now()
    status = subscription.status
    plan = subscription.plan

    if status == OrganisationSubscription.Status.ACTIVE:
        if (
            subscription.cancel_at_period_end
            and subscription.current_period_end
            and subscription.current_period_end <= now
        ):
            return free_plan(), subscription
        if plan.code == Plan.Code.FREE:
            return plan, subscription
        return plan, subscription

    if status == OrganisationSubscription.Status.PENDING:
        # Checkout started but not authorized yet — stay on free.
        return free_plan(), subscription

    if status == OrganisationSubscription.Status.PAST_DUE:
        since = subscription.past_due_since or subscription.updated_at
        if since + timedelta(days=_grace_days()) >= now and plan.code != Plan.Code.FREE:
            return plan, subscription
        return free_plan(), subscription

    if status == OrganisationSubscription.Status.PAUSED:
        return free_plan(), subscription

    # canceled
    if (
        subscription.current_period_end
        and subscription.current_period_end > now
        and plan.code != Plan.Code.FREE
    ):
        return plan, subscription
    return free_plan(), subscription


def get_organisation_entitlements(organisation: Organisation) -> OrganisationEntitlements:
    plan, subscription = effective_plan(organisation)
    product_count = count_billable_products(organisation)
    limit = plan.product_limit
    if limit is None:
        can_create = True
        remaining: int | None = None
    else:
        remaining = max(limit - product_count, 0)
        can_create = product_count < limit

    return OrganisationEntitlements(
        plan_code=plan.code,
        plan_name=plan.name,
        price_clp=plan.price_clp,
        product_limit=limit,
        product_count=product_count,
        ai_assisted_enabled=plan.ai_assisted_enabled,
        can_create_product=can_create,
        remaining_slots=remaining,
        subscription_status=(
            subscription.status
            if subscription is not None
            else (
                OrganisationSubscription.Status.ACTIVE
                if plan.code == Plan.Code.FREE
                else OrganisationSubscription.Status.PENDING
            )
        ),
        cancel_at_period_end=bool(subscription and subscription.cancel_at_period_end),
        current_period_end=subscription.current_period_end if subscription else None,
    )


def assert_can_create_product(organisation: Organisation) -> OrganisationEntitlements:
    entitlements = get_organisation_entitlements(organisation)
    if entitlements.can_create_product:
        return entitlements
    limit = entitlements.product_limit
    raise DomainError(
        "PRODUCT_LIMIT_REACHED",
        (
            f"Tu plan {entitlements.plan_name} permite hasta {limit} productos. "
            "Archiva productos o mejora tu plan para continuar."
        ),
        field_errors={
            "products": [
                f"Límite de {limit} productos alcanzado en el plan {entitlements.plan_name}."
            ]
        },
        status=409,
    )


def assert_ai_assisted_allowed(organisation: Organisation) -> OrganisationEntitlements:
    entitlements = get_organisation_entitlements(organisation)
    if entitlements.ai_assisted_enabled:
        return entitlements
    raise DomainError(
        "AI_FEATURE_REQUIRES_PLAN",
        "La creación asistida está disponible desde el plan Starter.",
        field_errors={
            "aiAssisted": [
                "Mejora tu plan para usar la búsqueda de productos con foto.",
            ]
        },
        status=402,
    )


def assert_import_fits_quota(organisation: Organisation, *, new_row_count: int) -> None:
    entitlements = get_organisation_entitlements(organisation)
    if entitlements.product_limit is None:
        return
    if new_row_count <= (entitlements.remaining_slots or 0):
        return
    raise DomainError(
        "PRODUCT_LIMIT_REACHED",
        (
            f"Esta importación agregaría {new_row_count} productos, pero tu plan "
            f"{entitlements.plan_name} solo tiene {entitlements.remaining_slots} cupos libres."
        ),
        status=409,
    )
