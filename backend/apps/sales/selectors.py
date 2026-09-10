"""Tenant-safe sales lists, guards, dashboard and BAL-01 projections."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import ROUND_DOWN, Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db.models import Q, QuerySet

from apps.organisations.permissions import (
    OrganisationPermission,
    has_permission,
    require_permission,
)
from apps.organisations.selectors import TenantContext
from tenda.errors import DomainError, ResourceNotFound
from tenda.pagination import Page, clean_page_size, decode_cursor, encode_cursor, paginate

from .models import Order, OrderItem, ReconciliationIssue

STATUS_LABELS: dict[str, str] = {
    Order.Status.DRAFT: "Borrador",
    Order.Status.RESERVED: "Reservado",
    Order.Status.PURCHASE_IN_PROGRESS: "Proceso de compra",
    Order.Status.PURCHASE_VALIDATION: "Validación de compra",
    Order.Status.PAID: "Vendido",
    Order.Status.CANCELLED: "Cancelado",
    Order.Status.EXPIRED: "Expirado",
    Order.Status.REFUNDED: "Reembolsado",
}


@dataclass(frozen=True, slots=True)
class SalesDashboard:
    total_orders: int
    active_orders: int
    awaiting_buyer: int
    awaiting_payment: int
    awaiting_validation: int
    paid_orders: int
    reconciliation_required: int
    confirmed_gross: Decimal


@dataclass(frozen=True, slots=True)
class OrderListFilter:
    search: str = ""
    statuses: tuple[str, ...] = ()
    payment_methods: tuple[str, ...] = ()
    product_id: uuid.UUID | None = None
    date_from: date | None = None
    date_to: date | None = None


@dataclass(frozen=True, slots=True)
class BalanceFilter:
    date_from: date | None = None
    date_to: date | None = None
    product_id: uuid.UUID | None = None
    payment_methods: tuple[str, ...] = ()
    statuses: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class SalesBalance:
    confirmed_gross: Decimal
    refunds: Decimal
    net_sales: Decimal
    known_cogs: Decimal
    gross_margin: Decimal
    pending_amount: Decimal
    validation_amount: Decimal
    operations: int
    recognized_lines: int
    known_cost_lines: int
    cost_coverage: Decimal
    cost_incomplete: bool


@dataclass(frozen=True, slots=True)
class BalanceBreakdownRow:
    period: date
    product_id: uuid.UUID
    product_name: str
    payment_method: str
    status: str
    quantity: int
    confirmed_gross: Decimal
    refunds: Decimal
    net_sales: Decimal
    known_cogs: Decimal
    gross_margin: Decimal
    recognized_lines: int
    known_cost_lines: int
    cost_incomplete: bool


@dataclass(frozen=True, slots=True)
class BalanceBreakdownPage:
    items: list[BalanceBreakdownRow]
    has_next_page: bool
    end_cursor: str
    total_count: int


@dataclass(frozen=True, slots=True)
class _LineMetric:
    item: OrderItem
    period: date
    payment_method: str
    status: str
    gross: Decimal
    refund: Decimal


def orders_for_context(context: TenantContext) -> QuerySet[Order]:
    return (
        Order.objects.filter(
            organisation=context.organisation,
            inventory=context.inventory,
        )
        .select_related(
            "buyer",
            "payment",
            "payment__proof",
            "payment__proof__asset",
            "organisation",
            "inventory",
            "created_by",
        )
        .prefetch_related(
            "items",
            "items__product",
            "reservations",
            "timeline",
            "reconciliation_issues",
        )
    )


def order_for_context(context: TenantContext, order_id: uuid.UUID) -> Order:
    order = orders_for_context(context).filter(public_id=order_id).first()
    if order is None:
        raise ResourceNotFound()
    return order


def paginated_orders(
    context: TenantContext,
    *,
    status: str = "",
    search: str = "",
    filters: OrderListFilter | None = None,
    first: int | None = None,
    after: str | None = None,
) -> Page[Order]:
    queryset = orders_for_context(context)
    list_filter = filters or OrderListFilter(search=search, statuses=(status,) if status else ())
    valid_statuses = {value for value, _label in Order.Status.choices}
    valid_methods = {value for value, _label in Order.PaymentMethod.choices}
    selected_statuses = tuple(
        dict.fromkeys([*list_filter.statuses, status] if status else list_filter.statuses)
    )
    if any(item not in valid_statuses for item in selected_statuses):
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los filtros.",
            field_errors={"status": ["Selecciona un estado válido."]},
        )
    if selected_statuses:
        queryset = queryset.filter(status__in=selected_statuses)
    if any(method not in valid_methods for method in list_filter.payment_methods):
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los filtros.",
            field_errors={"paymentMethods": ["Hay un medio de pago inválido."]},
        )
    if list_filter.payment_methods:
        queryset = queryset.filter(payment_method__in=list_filter.payment_methods)
    if list_filter.product_id is not None:
        queryset = queryset.filter(items__product__public_id=list_filter.product_id).distinct()
    start, end = _date_bounds(
        context,
        BalanceFilter(
            date_from=list_filter.date_from,
            date_to=list_filter.date_to,
        ),
    )
    if start is not None:
        queryset = queryset.filter(created_at__gte=start)
    if end is not None:
        queryset = queryset.filter(created_at__lt=end)
    cleaned_search = (list_filter.search or search).strip()
    if cleaned_search:
        queryset = queryset.filter(
            Q(number__icontains=cleaned_search)
            | Q(buyer__name__icontains=cleaned_search)
            | Q(buyer__email__icontains=cleaned_search)
            | Q(buyer__phone__icontains=cleaned_search)
        ).distinct()
    return paginate(
        queryset,
        cursor_field="created_at",
        after=after,
        first=first,
        descending=True,
    )


def sales_dashboard(context: TenantContext) -> SalesDashboard:
    queryset = Order.objects.filter(
        organisation=context.organisation,
        inventory=context.inventory,
    )
    paid = queryset.filter(status__in={Order.Status.PAID, Order.Status.REFUNDED})
    orphan_reconciliation_issues = ReconciliationIssue.objects.filter(
        organisation=context.organisation,
        order__isnull=True,
        status__in={
            ReconciliationIssue.Status.OPEN,
            ReconciliationIssue.Status.RETRYING,
        },
    ).count()
    reserved = queryset.filter(status=Order.Status.RESERVED)
    in_progress = queryset.filter(status=Order.Status.PURCHASE_IN_PROGRESS)
    return SalesDashboard(
        total_orders=queryset.count(),
        active_orders=reserved.count() + in_progress.count(),
        awaiting_buyer=reserved.count(),
        awaiting_payment=in_progress.count(),
        awaiting_validation=queryset.filter(status=Order.Status.PURCHASE_VALIDATION).count(),
        paid_orders=paid.count(),
        reconciliation_required=(
            queryset.exclude(reconciliation_status=Order.ReconciliationStatus.OK).count()
            + orphan_reconciliation_issues
        ),
        confirmed_gross=sum(
            (order.total_amount for order in paid.only("total_amount")),
            Decimal("0"),
        ),
    )


def can_view_costs(context: TenantContext) -> bool:
    return has_permission(context.membership, OrganisationPermission.VIEW_FINANCIALS)


def seller_next_action(order: Order) -> str:
    if order.reconciliation_status != Order.ReconciliationStatus.OK:
        return "reconcile"
    if order.status == Order.Status.PURCHASE_VALIDATION:
        return "review_proof"
    if order.status == Order.Status.PAID:
        return "prepare_delivery"
    if order.published_at is None and order.status in {
        Order.Status.RESERVED,
        Order.Status.PURCHASE_IN_PROGRESS,
    }:
        return "share_link"
    buyer = getattr(order, "buyer", None)
    if buyer is None and order.status in {
        Order.Status.RESERVED,
        Order.Status.PURCHASE_IN_PROGRESS,
    }:
        return "await_buyer"
    if order.status in {
        Order.Status.RESERVED,
        Order.Status.PURCHASE_IN_PROGRESS,
    }:
        return "await_payment"
    return "none"


def can_manage_reconciliation(context: TenantContext) -> bool:
    return context.membership.role in {
        context.membership.Role.OWNER,
        context.membership.Role.SUPPORT_ADMIN,
    }


def paginated_reconciliation_issues(
    context: TenantContext,
    *,
    status: str = "",
    first: int | None = None,
    after: str | None = None,
) -> Page[ReconciliationIssue]:
    if not can_manage_reconciliation(context):
        raise DomainError(
            "PERMISSION_DENIED",
            "No tienes acceso a la cola de conciliación.",
            status=403,
        )
    queryset = ReconciliationIssue.objects.filter(
        organisation=context.organisation,
    ).select_related("order", "payment", "webhook_event")
    if status:
        valid = {value for value, _label in ReconciliationIssue.Status.choices}
        if status not in valid:
            raise DomainError(
                "VALIDATION_ERROR",
                "Revisa los filtros.",
                field_errors={"status": ["Selecciona un estado válido."]},
            )
        queryset = queryset.filter(status=status)
    return paginate(
        queryset,
        cursor_field="created_at",
        after=after,
        first=first,
        descending=True,
    )


def seller_allowed_actions(order: Order) -> tuple[str, ...]:
    actions: list[str] = []
    if order.status in {
        Order.Status.RESERVED,
        Order.Status.PURCHASE_IN_PROGRESS,
        Order.Status.PURCHASE_VALIDATION,
    }:
        actions.extend(("cancelOrder", "resendOrderLink", "sendOfferLink"))
    if order.published_at is None and order.status in {
        Order.Status.RESERVED,
        Order.Status.PURCHASE_IN_PROGRESS,
    }:
        actions.append("publishOrderLink")
    if order.status == Order.Status.PURCHASE_VALIDATION:
        actions.append("reviewPaymentProof")
        if order.payment_method == Order.PaymentMethod.BANK_TRANSFER:
            actions.append("reissueBankTransferOffer")
    if order.status in {
        Order.Status.RESERVED,
        Order.Status.PURCHASE_IN_PROGRESS,
    } and order.payment_method in {Order.PaymentMethod.CASH, Order.PaymentMethod.BANK_TRANSFER}:
        actions.append("confirmManualPayment")
    if order.status == Order.Status.PAID:
        actions.append("refundPayment")
    if order.status == Order.Status.CANCELLED and order.timeline.filter(
        event_type="order.cancelled"
    ).exists():
        actions.append("restoreOrder")
    return tuple(actions)


def public_allowed_actions(order: Order) -> tuple[str, ...]:
    if order.status not in {
        Order.Status.RESERVED,
        Order.Status.PURCHASE_IN_PROGRESS,
    }:
        return ()
    actions = ["setBuyerDetails"]
    if order.payment_method == Order.PaymentMethod.MERCADO_PAGO:
        actions.append("initiateMercadoPagoCheckout")
    if order.payment_method == Order.PaymentMethod.BANK_TRANSFER:
        actions.append("uploadPaymentProof")
    return tuple(actions)


def _zone(context: TenantContext) -> ZoneInfo:
    try:
        return ZoneInfo(context.organisation.timezone)
    except ZoneInfoNotFoundError as exc:
        raise DomainError(
            "BUSINESS_TIMEZONE_INVALID",
            "La zona horaria del negocio no es válida.",
            status=409,
        ) from exc


def _date_bounds(
    context: TenantContext,
    filters: BalanceFilter,
) -> tuple[datetime | None, datetime | None]:
    zone = _zone(context)
    start = (
        datetime.combine(filters.date_from, time.min, tzinfo=zone)
        if filters.date_from is not None
        else None
    )
    end = (
        datetime.combine(filters.date_to + timedelta(days=1), time.min, tzinfo=zone)
        if filters.date_to is not None
        else None
    )
    if start is not None and end is not None and start >= end:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa el rango de fechas.",
            field_errors={"dateTo": ["Debe ser igual o posterior a la fecha inicial."]},
        )
    return start, end


def _validate_balance_filters(filters: BalanceFilter) -> None:
    methods = {value for value, _label in Order.PaymentMethod.choices}
    statuses = {value for value, _label in Order.Status.choices}
    if any(method not in methods for method in filters.payment_methods):
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los filtros.",
            field_errors={"paymentMethods": ["Hay un medio de pago inválido."]},
        )
    if any(status not in statuses for status in filters.statuses):
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los filtros.",
            field_errors={"statuses": ["Hay un estado inválido."]},
        )


def _recognized_orders(
    context: TenantContext,
    filters: BalanceFilter,
) -> list[Order]:
    _validate_balance_filters(filters)
    start, end = _date_bounds(context, filters)
    queryset = (
        Order.objects.filter(
            organisation=context.organisation,
            inventory=context.inventory,
            status__in={Order.Status.PAID, Order.Status.REFUNDED},
            paid_at__isnull=False,
        )
        .select_related("payment")
        .prefetch_related("items", "items__product")
    )
    if start is not None:
        queryset = queryset.filter(paid_at__gte=start)
    if end is not None:
        queryset = queryset.filter(paid_at__lt=end)
    if filters.payment_methods:
        queryset = queryset.filter(payment_method__in=filters.payment_methods)
    if filters.statuses:
        queryset = queryset.filter(status__in=filters.statuses)
    if filters.product_id is not None:
        queryset = queryset.filter(items__product__public_id=filters.product_id).distinct()
    return list(queryset.order_by("paid_at", "pk"))


def _refund_allocations(order: Order, items: list[OrderItem]) -> dict[int, Decimal]:
    payment = getattr(order, "payment", None)
    refunded = Decimal(getattr(payment, "refunded_amount", 0) or 0)
    if refunded <= 0 or not items:
        return {item.pk: Decimal("0") for item in items}
    gross_values = [Decimal(item.line_total) for item in items]
    total = sum(gross_values, Decimal("0"))
    if total <= 0:
        return {item.pk: Decimal("0") for item in items}
    remaining = min(refunded, total)
    allocations: dict[int, Decimal] = {}
    for item, gross in zip(items[:-1], gross_values[:-1], strict=True):
        allocation = (refunded * gross / total).quantize(Decimal("1"), rounding=ROUND_DOWN)
        allocation = min(allocation, gross, remaining)
        allocations[item.pk] = allocation
        remaining -= allocation
    allocations[items[-1].pk] = min(remaining, gross_values[-1])
    return allocations


def _line_metrics(
    context: TenantContext,
    filters: BalanceFilter,
) -> list[_LineMetric]:
    zone = _zone(context)
    metrics: list[_LineMetric] = []
    for order in _recognized_orders(context, filters):
        all_items = list(order.items.all())
        allocations = _refund_allocations(order, all_items)
        selected = all_items
        if filters.product_id is not None:
            selected = [item for item in all_items if item.product.public_id == filters.product_id]
        assert order.paid_at is not None
        period = order.paid_at.astimezone(zone).date()
        metrics.extend(
            _LineMetric(
                item=item,
                period=period,
                payment_method=order.payment_method,
                status=order.status,
                gross=Decimal(item.line_total),
                refund=allocations[item.pk],
            )
            for item in selected
        )
    return metrics


def _pending_amounts(
    context: TenantContext,
    filters: BalanceFilter,
) -> tuple[Decimal, Decimal]:
    start, end = _date_bounds(context, filters)
    queryset = OrderItem.objects.filter(
        order__organisation=context.organisation,
        order__inventory=context.inventory,
        order__status__in={
            Order.Status.RESERVED,
            Order.Status.PURCHASE_IN_PROGRESS,
            Order.Status.PURCHASE_VALIDATION,
        },
    ).select_related("order", "product")
    if start is not None:
        queryset = queryset.filter(order__created_at__gte=start)
    if end is not None:
        queryset = queryset.filter(order__created_at__lt=end)
    if filters.product_id is not None:
        queryset = queryset.filter(product__public_id=filters.product_id)
    if filters.payment_methods:
        queryset = queryset.filter(order__payment_method__in=filters.payment_methods)
    if filters.statuses:
        queryset = queryset.filter(order__status__in=filters.statuses)
    pending = Decimal("0")
    validation = Decimal("0")
    for item in queryset:
        value = Decimal(item.line_total)
        if item.order.status == Order.Status.PURCHASE_VALIDATION:
            validation += value
        else:
            pending += value
    return pending, validation


def sales_balance(
    context: TenantContext,
    *,
    filters: BalanceFilter,
) -> SalesBalance:
    require_permission(context.membership, OrganisationPermission.VIEW_FINANCIALS)
    metrics = _line_metrics(context, filters)
    gross = sum((metric.gross for metric in metrics), Decimal("0"))
    refunds = sum((metric.refund for metric in metrics), Decimal("0"))
    known_cogs = sum(
        (
            Decimal(metric.item.unit_cost_snapshot) * metric.item.quantity
            for metric in metrics
            if metric.item.unit_cost_snapshot is not None
        ),
        Decimal("0"),
    )
    recognized_lines = len(metrics)
    known_cost_lines = sum(1 for metric in metrics if metric.item.unit_cost_snapshot is not None)
    coverage = (
        Decimal(known_cost_lines) * Decimal("100") / Decimal(recognized_lines)
        if recognized_lines
        else Decimal("100")
    )
    pending, validation = _pending_amounts(context, filters)
    return SalesBalance(
        confirmed_gross=gross,
        refunds=refunds,
        net_sales=gross - refunds,
        known_cogs=known_cogs,
        gross_margin=gross - refunds - known_cogs,
        pending_amount=pending,
        validation_amount=validation,
        operations=len({metric.item.order_id for metric in metrics}),
        recognized_lines=recognized_lines,
        known_cost_lines=known_cost_lines,
        cost_coverage=coverage,
        cost_incomplete=known_cost_lines < recognized_lines,
    )


def sales_balance_breakdown(
    context: TenantContext,
    *,
    filters: BalanceFilter,
    first: int | None = None,
    after: str | None = None,
) -> BalanceBreakdownPage:
    require_permission(context.membership, OrganisationPermission.VIEW_FINANCIALS)
    grouped: dict[tuple[date, uuid.UUID, str, str, str], dict[str, Decimal | int]] = {}
    for metric in _line_metrics(context, filters):
        key = (
            metric.period,
            metric.item.product.public_id,
            metric.item.product_name,
            metric.payment_method,
            metric.status,
        )
        values = grouped.setdefault(
            key,
            {
                "quantity": 0,
                "gross": Decimal("0"),
                "refund": Decimal("0"),
                "cost": Decimal("0"),
                "lines": 0,
                "known": 0,
            },
        )
        values["quantity"] = int(values["quantity"]) + metric.item.quantity
        values["gross"] = Decimal(values["gross"]) + metric.gross
        values["refund"] = Decimal(values["refund"]) + metric.refund
        values["lines"] = int(values["lines"]) + 1
        if metric.item.unit_cost_snapshot is not None:
            values["known"] = int(values["known"]) + 1
            values["cost"] = Decimal(values["cost"]) + (
                Decimal(metric.item.unit_cost_snapshot) * metric.item.quantity
            )
    rows: list[BalanceBreakdownRow] = []
    for key, values in grouped.items():
        period, product_id, product_name, payment_method, status = key
        gross = Decimal(values["gross"])
        refunds = Decimal(values["refund"])
        cost = Decimal(values["cost"])
        lines = int(values["lines"])
        known = int(values["known"])
        rows.append(
            BalanceBreakdownRow(
                period=period,
                product_id=product_id,
                product_name=product_name,
                payment_method=payment_method,
                status=status,
                quantity=int(values["quantity"]),
                confirmed_gross=gross,
                refunds=refunds,
                net_sales=gross - refunds,
                known_cogs=cost,
                gross_margin=gross - refunds - cost,
                recognized_lines=lines,
                known_cost_lines=known,
                cost_incomplete=known < lines,
            )
        )
    rows.sort(
        key=lambda row: (
            -row.period.toordinal(),
            row.product_name.casefold(),
            str(row.product_id),
            row.payment_method,
            row.status,
        )
    )
    size = clean_page_size(first)
    start = 0
    if after:
        _value, identifier = decode_cursor(after)
        if identifier < 0 or identifier > len(rows):
            raise DomainError(
                "INVALID_CURSOR",
                "El cursor de paginación no es válido.",
                field_errors={"after": ["Vuelve a cargar la lista."]},
            )
        start = identifier
    window = rows[start : start + size + 1]
    items = window[:size]
    has_next = len(window) > size
    end_cursor = encode_cursor(items[-1].period, start + len(items)) if items else ""
    return BalanceBreakdownPage(
        items=items,
        has_next_page=has_next,
        end_cursor=end_cursor,
        total_count=len(rows),
    )
