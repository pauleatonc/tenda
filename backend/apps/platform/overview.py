"""Platform-wide figures for staff. These are coarse totals, not a ledger."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum
from django.utils import timezone

from apps.billing.models import OrganisationSubscription, Plan
from apps.inventory.models import Product, StockBalance
from apps.organisations.models import Organisation
from apps.sales.models import Order, OrderItem, Payment
from apps.shipping.models import Shipment


@dataclass(frozen=True, slots=True)
class PlanPopulation:
    code: str
    name: str
    organisation_count: int


@dataclass(frozen=True, slots=True)
class StaffPlatformOverview:
    generated_at: object
    organisation_count: int
    organisations_last_30_days: int
    organisations_with_sales: int
    plans: list[PlanPopulation]
    active_product_count: int
    archived_product_count: int
    products_missing_cost: int
    inventory_units: int
    inventory_reserved_units: int
    inventory_at_cost: Decimal
    inventory_at_sale_price: Decimal
    inventory_cost_complete: bool
    confirmed_sales_amount: Decimal
    confirmed_sales_count: int
    refunded_amount: Decimal
    net_sales_amount: Decimal
    known_cogs: Decimal
    gross_margin: Decimal
    sales_cost_complete: bool
    pending_sales_amount: Decimal
    pending_sales_count: int
    pending_shipment_count: int


def _money(value: Decimal | int | None) -> Decimal:
    if value is None:
        return Decimal(0)
    return Decimal(value)


def _effective_plan_code(
    subscription: OrganisationSubscription | None,
    *,
    now: datetime,
    grace: timedelta,
) -> str:
    if subscription is None:
        return Plan.Code.FREE
    status = subscription.status
    plan = subscription.plan
    if status == OrganisationSubscription.Status.ACTIVE:
        period_end = subscription.current_period_end
        if subscription.cancel_at_period_end and period_end is not None and period_end <= now:
            return Plan.Code.FREE
        return plan.code
    if status == OrganisationSubscription.Status.PENDING:
        return Plan.Code.FREE
    if status == OrganisationSubscription.Status.PAST_DUE:
        since = subscription.past_due_since or subscription.updated_at
        if since + grace >= now and plan.code != Plan.Code.FREE:
            return plan.code
        return Plan.Code.FREE
    if status == OrganisationSubscription.Status.PAUSED:
        return Plan.Code.FREE
    period_end = subscription.current_period_end
    if period_end is not None and period_end > now and plan.code != Plan.Code.FREE:
        return plan.code
    return Plan.Code.FREE


def staff_platform_overview() -> StaffPlatformOverview:
    now = timezone.now()
    grace = timedelta(days=int(getattr(settings, "BILLING_PAST_DUE_GRACE_DAYS", 3)))
    plans = list(Plan.objects.filter(is_active=True).order_by("position", "price_clp"))
    subscriptions = {
        subscription.organisation_id: subscription
        for subscription in OrganisationSubscription.objects.select_related("plan")
    }
    counts = {plan.code: 0 for plan in plans}
    organisations = Organisation.objects.filter(is_active=True)
    organisation_count = 0
    for organisation in organisations.iterator():
        organisation_count += 1
        code = _effective_plan_code(subscriptions.get(organisation.pk), now=now, grace=grace)
        counts[code] = counts.get(code, 0) + 1

    active_products = Product.objects.exclude(catalog_status=Product.CatalogStatus.ARCHIVED)
    stock = StockBalance.objects.filter(
        product__catalog_status__in=(
            Product.CatalogStatus.ACTIVE,
            Product.CatalogStatus.INACTIVE,
        )
    )
    money = DecimalField(max_digits=18, decimal_places=0)
    cost_value = stock.filter(product__purchase_price__isnull=False).aggregate(
        total=Sum(
            ExpressionWrapper(
                F("on_hand") * F("product__purchase_price"),
                output_field=money,
            )
        )
    )["total"]
    sale_value = stock.filter(product__sale_price__isnull=False).aggregate(
        total=Sum(
            ExpressionWrapper(
                F("on_hand") * F("product__sale_price"),
                output_field=money,
            )
        )
    )["total"]
    units = stock.aggregate(on_hand=Sum("on_hand"), reserved=Sum("reserved"))
    units_with_cost = (
        stock.filter(product__purchase_price__isnull=False).aggregate(total=Sum("on_hand"))["total"]
        or 0
    )
    units_on_hand = int(units["on_hand"] or 0)

    confirmed = Order.objects.filter(status=Order.Status.PAID, paid_at__isnull=False).aggregate(
        total=Sum("total_amount"),
        count=Count("id"),
    )
    refunded = Payment.objects.aggregate(total=Sum("refunded_amount"))["total"]
    recognized_items = OrderItem.objects.filter(
        order__status__in=(Order.Status.PAID, Order.Status.REFUNDED),
        order__paid_at__isnull=False,
    )
    known_cogs = recognized_items.filter(unit_cost_snapshot__isnull=False).aggregate(
        total=Sum(
            ExpressionWrapper(
                F("unit_cost_snapshot") * F("quantity"),
                output_field=money,
            )
        )
    )["total"]
    item_counts = recognized_items.aggregate(
        total=Count("id"),
        known=Count("id", filter=Q(unit_cost_snapshot__isnull=False)),
    )
    pending = Order.objects.filter(
        status__in=(
            Order.Status.RESERVED,
            Order.Status.PURCHASE_IN_PROGRESS,
            Order.Status.PURCHASE_VALIDATION,
        )
    ).aggregate(total=Sum("total_amount"), count=Count("id"))
    confirmed_amount = _money(confirmed["total"])
    refunded_amount = _money(refunded)
    known_cogs_amount = _money(known_cogs)

    return StaffPlatformOverview(
        generated_at=now,
        organisation_count=organisation_count,
        organisations_last_30_days=organisations.filter(
            created_at__gte=now - timedelta(days=30)
        ).count(),
        organisations_with_sales=Order.objects.filter(
            status=Order.Status.PAID,
            paid_at__isnull=False,
        )
        .values("organisation_id")
        .distinct()
        .count(),
        plans=[
            PlanPopulation(
                code=plan.code,
                name=plan.name,
                organisation_count=counts.get(plan.code, 0),
            )
            for plan in plans
        ],
        active_product_count=active_products.count(),
        archived_product_count=Product.objects.filter(
            catalog_status=Product.CatalogStatus.ARCHIVED
        ).count(),
        products_missing_cost=active_products.filter(purchase_price__isnull=True).count(),
        inventory_units=units_on_hand,
        inventory_reserved_units=int(units["reserved"] or 0),
        inventory_at_cost=_money(cost_value),
        inventory_at_sale_price=_money(sale_value),
        inventory_cost_complete=units_with_cost >= units_on_hand,
        confirmed_sales_amount=confirmed_amount,
        confirmed_sales_count=int(confirmed["count"] or 0),
        refunded_amount=refunded_amount,
        net_sales_amount=confirmed_amount - refunded_amount,
        known_cogs=known_cogs_amount,
        gross_margin=confirmed_amount - refunded_amount - known_cogs_amount,
        sales_cost_complete=int(item_counts["known"] or 0) >= int(item_counts["total"] or 0),
        pending_sales_amount=_money(pending["total"]),
        pending_sales_count=int(pending["count"] or 0),
        pending_shipment_count=Shipment.objects.filter(status=Shipment.Status.PENDING).count(),
    )
