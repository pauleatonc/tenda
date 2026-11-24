"""Staff-only platform figures. Merchant queries never reach this resolver."""

from __future__ import annotations

import graphene
from graphql import GraphQLResolveInfo

from tenda.errors import DomainError, PermissionDenied
from tenda.graphql import graphql_error, user_from_info

from .overview import StaffPlatformOverview, staff_platform_overview


class StaffPlanCountType(graphene.ObjectType):  # type: ignore[misc]
    code = graphene.String(required=True)
    name = graphene.String(required=True)
    organisation_count = graphene.Int(required=True)
    price_clp = graphene.Int(required=True)
    monthly_revenue = graphene.Int(required=True)


class StaffPlatformOverviewType(graphene.ObjectType):  # type: ignore[misc]
    generated_at = graphene.DateTime(required=True)
    organisation_count = graphene.Int(required=True)
    organisations_last_30_days = graphene.Int(required=True)
    organisations_with_sales = graphene.Int(required=True)
    plans = graphene.List(graphene.NonNull(StaffPlanCountType), required=True)
    estimated_monthly_revenue = graphene.Int(required=True)
    active_product_count = graphene.Int(required=True)
    archived_product_count = graphene.Int(required=True)
    products_missing_cost = graphene.Int(required=True)
    inventory_units = graphene.Int(required=True)
    inventory_reserved_units = graphene.Int(required=True)
    inventory_at_cost = graphene.String(required=True)
    inventory_at_sale_price = graphene.String(required=True)
    inventory_cost_complete = graphene.Boolean(required=True)
    confirmed_sales_amount = graphene.String(required=True)
    confirmed_sales_count = graphene.Int(required=True)
    refunded_amount = graphene.String(required=True)
    net_sales_amount = graphene.String(required=True)
    known_cogs = graphene.String(required=True)
    gross_margin = graphene.String(required=True)
    sales_cost_complete = graphene.Boolean(required=True)
    pending_sales_amount = graphene.String(required=True)
    pending_sales_count = graphene.Int(required=True)
    pending_shipment_count = graphene.Int(required=True)

    @staticmethod
    def resolve_inventory_at_cost(root: StaffPlatformOverview, _info: GraphQLResolveInfo) -> str:
        return str(root.inventory_at_cost)

    @staticmethod
    def resolve_inventory_at_sale_price(
        root: StaffPlatformOverview, _info: GraphQLResolveInfo
    ) -> str:
        return str(root.inventory_at_sale_price)

    @staticmethod
    def resolve_confirmed_sales_amount(
        root: StaffPlatformOverview, _info: GraphQLResolveInfo
    ) -> str:
        return str(root.confirmed_sales_amount)

    @staticmethod
    def resolve_refunded_amount(root: StaffPlatformOverview, _info: GraphQLResolveInfo) -> str:
        return str(root.refunded_amount)

    @staticmethod
    def resolve_net_sales_amount(root: StaffPlatformOverview, _info: GraphQLResolveInfo) -> str:
        return str(root.net_sales_amount)

    @staticmethod
    def resolve_known_cogs(root: StaffPlatformOverview, _info: GraphQLResolveInfo) -> str:
        return str(root.known_cogs)

    @staticmethod
    def resolve_gross_margin(root: StaffPlatformOverview, _info: GraphQLResolveInfo) -> str:
        return str(root.gross_margin)

    @staticmethod
    def resolve_pending_sales_amount(root: StaffPlatformOverview, _info: GraphQLResolveInfo) -> str:
        return str(root.pending_sales_amount)


class PlatformQuery(graphene.ObjectType):  # type: ignore[misc]
    staff_platform_overview = graphene.Field(StaffPlatformOverviewType, required=True)

    @staticmethod
    def resolve_staff_platform_overview(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> StaffPlatformOverview:
        try:
            if not user_from_info(info).is_staff:
                raise PermissionDenied()
            return staff_platform_overview()
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
