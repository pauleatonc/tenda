"""GraphQL surface for organisation billing entitlements and checkout."""

from __future__ import annotations

from typing import Any

import graphene
from graphql import GraphQLResolveInfo

from tenda.errors import DomainError
from tenda.graphql import context_from_info, graphql_error

from .services import (
    BillingOverview,
    PlanCheckout,
    billing_overview,
    cancel_subscription,
    resume_subscription,
    start_plan_checkout,
)


class BillingPlanType(graphene.ObjectType):  # type: ignore[misc]
    code = graphene.String(required=True)
    name = graphene.String(required=True)
    price_clp = graphene.Int(required=True)
    product_limit = graphene.Int()
    ai_assisted_enabled = graphene.Boolean(required=True)
    is_current = graphene.Boolean(required=True)


class OrganisationBillingType(graphene.ObjectType):  # type: ignore[misc]
    plan_code = graphene.String(required=True)
    plan_name = graphene.String(required=True)
    price_clp = graphene.Int(required=True)
    product_limit = graphene.Int()
    product_count = graphene.Int(required=True)
    remaining_slots = graphene.Int()
    ai_assisted_enabled = graphene.Boolean(required=True)
    can_create_product = graphene.Boolean(required=True)
    subscription_status = graphene.String(required=True)
    cancel_at_period_end = graphene.Boolean(required=True)
    current_period_end = graphene.DateTime()
    plans = graphene.List(graphene.NonNull(BillingPlanType), required=True)


class StartPlanCheckoutPayload(graphene.ObjectType):  # type: ignore[misc]
    init_point = graphene.String(required=True)
    plan_code = graphene.String(required=True)
    preapproval_id = graphene.String(required=True)


class CancelSubscriptionPayload(graphene.ObjectType):  # type: ignore[misc]
    organisation_billing = graphene.Field(OrganisationBillingType, required=True)


class ResumeSubscriptionPayload(graphene.ObjectType):  # type: ignore[misc]
    organisation_billing = graphene.Field(OrganisationBillingType, required=True)


def _plan_nodes(overview: BillingOverview) -> list[dict[str, Any]]:
    current = overview.entitlements.plan_code
    return [
        {
            "code": plan.code,
            "name": plan.name,
            "price_clp": plan.price_clp,
            "product_limit": plan.product_limit,
            "ai_assisted_enabled": plan.ai_assisted_enabled,
            "is_current": plan.code == current,
        }
        for plan in overview.plans
    ]


def _billing_payload(overview: BillingOverview) -> dict[str, Any]:
    entitlements = overview.entitlements
    return {
        "plan_code": entitlements.plan_code,
        "plan_name": entitlements.plan_name,
        "price_clp": entitlements.price_clp,
        "product_limit": entitlements.product_limit,
        "product_count": entitlements.product_count,
        "remaining_slots": entitlements.remaining_slots,
        "ai_assisted_enabled": entitlements.ai_assisted_enabled,
        "can_create_product": entitlements.can_create_product,
        "subscription_status": entitlements.subscription_status,
        "cancel_at_period_end": entitlements.cancel_at_period_end,
        "current_period_end": entitlements.current_period_end,
        "plans": _plan_nodes(overview),
    }


class StartPlanCheckout(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        plan_code = graphene.String(required=True)
        payer_email = graphene.String()

    Output = StartPlanCheckoutPayload

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        plan_code: str,
        payer_email: str | None = None,
    ) -> PlanCheckout:
        try:
            return start_plan_checkout(
                context=context_from_info(info),
                plan_code=plan_code,
                payer_email=payer_email or "",
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc


class CancelSubscription(graphene.Mutation):  # type: ignore[misc]
    Output = CancelSubscriptionPayload

    @staticmethod
    def mutate(_root: object, info: GraphQLResolveInfo) -> dict[str, Any]:
        try:
            context = context_from_info(info)
            cancel_subscription(context=context)
            return {"organisation_billing": _billing_payload(billing_overview(context))}
        except DomainError as exc:
            raise graphql_error(info, exc) from exc


class ResumeSubscription(graphene.Mutation):  # type: ignore[misc]
    Output = ResumeSubscriptionPayload

    @staticmethod
    def mutate(_root: object, info: GraphQLResolveInfo) -> dict[str, Any]:
        try:
            context = context_from_info(info)
            resume_subscription(context=context)
            return {"organisation_billing": _billing_payload(billing_overview(context))}
        except DomainError as exc:
            raise graphql_error(info, exc) from exc


class BillingQuery(graphene.ObjectType):  # type: ignore[misc]
    organisation_billing = graphene.Field(OrganisationBillingType, required=True)

    @staticmethod
    def resolve_organisation_billing(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> dict[str, Any]:
        try:
            return _billing_payload(billing_overview(context_from_info(info)))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc


class BillingMutation(graphene.ObjectType):  # type: ignore[misc]
    start_plan_checkout = StartPlanCheckout.Field(required=True)
    cancel_subscription = CancelSubscription.Field(required=True)
    resume_subscription = ResumeSubscription.Field(required=True)
