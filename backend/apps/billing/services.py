"""Organisation plan checkout and subscription lifecycle."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.organisations.models import Organisation
from apps.organisations.permissions import OrganisationPermission, require_permission
from apps.organisations.selectors import TenantContext
from tenda.errors import DomainError

from .entitlements import OrganisationEntitlements, free_plan, get_organisation_entitlements
from .models import OrganisationSubscription, Plan
from .provider import PreapprovalSnapshot, get_billing_provider


@dataclass(frozen=True, slots=True)
class PlanCheckout:
    init_point: str
    plan_code: str
    preapproval_id: str


@dataclass(frozen=True, slots=True)
class BillingOverview:
    entitlements: OrganisationEntitlements
    plans: list[Plan]
    subscription: OrganisationSubscription | None


def list_active_plans() -> list[Plan]:
    return list(Plan.objects.filter(is_active=True).order_by("position", "price_clp"))


def record_plan_intent(*, organisation: Organisation, plan_code: str) -> Plan:
    """Persist the plan chosen after signup (free active, paid pending checkout)."""

    code = (plan_code or Plan.Code.FREE).strip().lower() or Plan.Code.FREE
    plan = Plan.objects.filter(code=code, is_active=True).first()
    if plan is None:
        raise DomainError(
            "PLAN_NOT_AVAILABLE",
            "Ese plan no está disponible.",
            field_errors={"planCode": ["Elige un plan válido."]},
            status=400,
        )
    if plan.code == Plan.Code.FREE:
        OrganisationSubscription.objects.update_or_create(
            organisation=organisation,
            defaults={
                "plan": plan,
                "status": OrganisationSubscription.Status.ACTIVE,
                "mp_preapproval_id": "",
                "init_point": "",
                "cancel_at_period_end": False,
                "past_due_since": None,
                "current_period_end": None,
            },
        )
        return plan

    OrganisationSubscription.objects.update_or_create(
        organisation=organisation,
        defaults={
            "plan": plan,
            "status": OrganisationSubscription.Status.PENDING,
            "mp_preapproval_id": "",
            "init_point": "",
            "cancel_at_period_end": False,
            "past_due_since": None,
            "current_period_end": None,
        },
    )
    return plan


def organisation_needs_plan_selection(organisation: Organisation) -> bool:
    """True until the owner completes the post-signup plan step."""

    return not OrganisationSubscription.objects.filter(organisation=organisation).exists()


@transaction.atomic
def select_signup_plan(*, context: TenantContext, plan_code: str) -> BillingOverview:
    """Complete onboarding plan selection before the dashboard."""

    _require_billing_manager(context)
    record_plan_intent(organisation=context.organisation, plan_code=plan_code)
    return billing_overview(context)


def billing_overview(context: TenantContext) -> BillingOverview:
    entitlements = get_organisation_entitlements(context.organisation)
    subscription = (
        OrganisationSubscription.objects.select_related("plan")
        .filter(organisation=context.organisation)
        .first()
    )
    return BillingOverview(
        entitlements=entitlements,
        plans=list_active_plans(),
        subscription=subscription,
    )


def _require_billing_manager(context: TenantContext) -> None:
    require_permission(
        context.membership,
        OrganisationPermission.MANAGE_SENSITIVE_CONFIGURATION,
    )


def _external_reference(organisation: Organisation, plan: Plan) -> str:
    return f"tenda-billing:{organisation.public_id}:{plan.code}"


def _map_mp_status(status: str) -> str:
    normalized = status.strip().lower()
    if normalized in {"authorized", "active"}:
        return OrganisationSubscription.Status.ACTIVE
    if normalized in {"paused"}:
        return OrganisationSubscription.Status.PAUSED
    if normalized in {"cancelled", "canceled"}:
        return OrganisationSubscription.Status.CANCELED
    if normalized in {"pending"}:
        return OrganisationSubscription.Status.PENDING
    return OrganisationSubscription.Status.PAST_DUE


def _period_end_from_snapshot(snapshot: PreapprovalSnapshot) -> datetime | None:
    if not snapshot.next_payment_date:
        return timezone.now() + timedelta(days=31)
    parsed = parse_datetime(snapshot.next_payment_date)
    if parsed is None:
        return timezone.now() + timedelta(days=31)
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


@transaction.atomic
def start_plan_checkout(
    *,
    context: TenantContext,
    plan_code: str,
    payer_email: str = "",
) -> PlanCheckout:
    _require_billing_manager(context)
    code = plan_code.strip().lower()
    if code == Plan.Code.FREE:
        raise DomainError(
            "VALIDATION_ERROR",
            "El plan gratis no requiere checkout.",
            field_errors={"planCode": ["Elige un plan de pago."]},
        )
    plan = Plan.objects.filter(code=code, is_active=True).first()
    if plan is None or not plan.mp_preapproval_plan_id:
        raise DomainError(
            "PLAN_NOT_AVAILABLE",
            "Ese plan no está disponible por ahora.",
            status=404,
        )

    email = (payer_email or context.user.email or "").strip()
    if not email:
        raise DomainError(
            "VALIDATION_ERROR",
            "Necesitamos un correo para iniciar la suscripción.",
            field_errors={"payerEmail": ["Indica un correo válido."]},
        )

    provider = get_billing_provider()
    back_url = str(
        getattr(settings, "BILLING_BACK_URL", "")
        or f"{getattr(settings, 'WEB_ORIGIN', 'http://localhost:5173')}/app/configuracion/plan"
    )
    snapshot = provider.create_preapproval(
        preapproval_plan_id=plan.mp_preapproval_plan_id,
        payer_email=email,
        external_reference=_external_reference(context.organisation, plan),
        back_url=back_url,
    )
    if not snapshot.init_point:
        raise DomainError(
            "BILLING_PROVIDER_ERROR",
            "Mercado Pago no devolvió un enlace de pago.",
            status=502,
        )

    subscription, _created = OrganisationSubscription.objects.select_for_update().get_or_create(
        organisation=context.organisation,
        defaults={
            "plan": plan,
            "status": OrganisationSubscription.Status.PENDING,
        },
    )
    # Keep previous paid plan until the new preapproval is authorized; mark pending target.
    subscription.plan = plan
    subscription.status = OrganisationSubscription.Status.PENDING
    subscription.mp_preapproval_id = snapshot.provider_id
    subscription.init_point = snapshot.init_point
    subscription.payer_email = email
    subscription.cancel_at_period_end = False
    subscription.past_due_since = None
    subscription.save(
        update_fields=(
            "plan",
            "status",
            "mp_preapproval_id",
            "init_point",
            "payer_email",
            "cancel_at_period_end",
            "past_due_since",
            "updated_at",
        )
    )
    return PlanCheckout(
        init_point=snapshot.init_point,
        plan_code=plan.code,
        preapproval_id=snapshot.provider_id,
    )


@transaction.atomic
def cancel_subscription(*, context: TenantContext) -> OrganisationSubscription:
    _require_billing_manager(context)
    subscription = (
        OrganisationSubscription.objects.select_for_update()
        .select_related("plan")
        .filter(organisation=context.organisation)
        .first()
    )
    if subscription is None or subscription.plan.code == Plan.Code.FREE:
        raise DomainError(
            "NO_ACTIVE_SUBSCRIPTION",
            "No hay una suscripción de pago para cancelar.",
            status=409,
        )
    if subscription.mp_preapproval_id:
        get_billing_provider().cancel_preapproval(subscription.mp_preapproval_id)
    subscription.cancel_at_period_end = True
    if not subscription.current_period_end:
        subscription.current_period_end = timezone.now() + timedelta(days=31)
    if subscription.status == OrganisationSubscription.Status.PENDING:
        subscription.status = OrganisationSubscription.Status.CANCELED
        subscription.plan = free_plan()
    subscription.save(
        update_fields=(
            "cancel_at_period_end",
            "current_period_end",
            "status",
            "plan",
            "updated_at",
        )
    )
    return subscription


@transaction.atomic
def resume_subscription(*, context: TenantContext) -> OrganisationSubscription:
    _require_billing_manager(context)
    subscription = (
        OrganisationSubscription.objects.select_for_update()
        .select_related("plan")
        .filter(organisation=context.organisation)
        .first()
    )
    if subscription is None or not subscription.mp_preapproval_id:
        raise DomainError(
            "NO_ACTIVE_SUBSCRIPTION",
            "No hay una suscripción para reactivar.",
            status=409,
        )
    if subscription.status not in {
        OrganisationSubscription.Status.PAUSED,
        OrganisationSubscription.Status.CANCELED,
    } and not subscription.cancel_at_period_end:
        raise DomainError(
            "SUBSCRIPTION_NOT_PAUSED",
            "La suscripción no está pausada.",
            status=409,
        )
    snapshot = get_billing_provider().resume_preapproval(subscription.mp_preapproval_id)
    apply_preapproval_snapshot(subscription=subscription, snapshot=snapshot)
    return subscription


def apply_preapproval_snapshot(
    *,
    subscription: OrganisationSubscription,
    snapshot: PreapprovalSnapshot,
) -> OrganisationSubscription:
    mapped = _map_mp_status(snapshot.status)
    subscription.mp_preapproval_id = snapshot.provider_id or subscription.mp_preapproval_id
    subscription.status = mapped
    if snapshot.init_point:
        subscription.init_point = snapshot.init_point
    if snapshot.payer_email:
        subscription.payer_email = snapshot.payer_email
    subscription.current_period_end = _period_end_from_snapshot(snapshot)
    if mapped == OrganisationSubscription.Status.PAST_DUE:
        subscription.past_due_since = subscription.past_due_since or timezone.now()
    elif mapped == OrganisationSubscription.Status.ACTIVE:
        subscription.past_due_since = None
        subscription.cancel_at_period_end = False
    elif mapped == OrganisationSubscription.Status.CANCELED:
        subscription.cancel_at_period_end = True
    subscription.save(
        update_fields=(
            "mp_preapproval_id",
            "status",
            "init_point",
            "payer_email",
            "current_period_end",
            "past_due_since",
            "cancel_at_period_end",
            "updated_at",
        )
    )
    return subscription


def sync_subscription_from_provider(preapproval_id: str) -> OrganisationSubscription | None:
    subscription = (
        OrganisationSubscription.objects.select_related("plan", "organisation")
        .filter(mp_preapproval_id=preapproval_id)
        .first()
    )
    if subscription is None:
        return None
    snapshot = get_billing_provider().get_preapproval(preapproval_id)
    # Resolve plan from external_reference when present.
    ref = snapshot.external_reference
    if ref.startswith("tenda-billing:") and ":" in ref:
        parts = ref.split(":")
        if len(parts) >= 3:
            plan = Plan.objects.filter(code=parts[-1], is_active=True).first()
            if plan is not None:
                subscription.plan = plan
                subscription.save(update_fields=("plan", "updated_at"))
    return apply_preapproval_snapshot(subscription=subscription, snapshot=snapshot)


def ensure_plan_preapproval_ids(*, force: bool = False) -> list[dict[str, Any]]:
    """Create or refresh Mercado Pago preapproval_plan IDs for paid tiers."""

    provider = get_billing_provider()
    results: list[dict[str, Any]] = []
    for plan in Plan.objects.filter(is_active=True).exclude(code=Plan.Code.FREE):
        existing = "" if force else plan.mp_preapproval_plan_id
        snapshot = provider.ensure_preapproval_plan(
            reason=f"Tenda {plan.name}",
            amount_clp=plan.price_clp,
            existing_id=existing,
        )
        plan.mp_preapproval_plan_id = snapshot.provider_id
        plan.save(update_fields=("mp_preapproval_plan_id", "updated_at"))
        results.append(
            {
                "code": plan.code,
                "mp_preapproval_plan_id": snapshot.provider_id,
                "amount_clp": plan.price_clp,
            }
        )
    return results
