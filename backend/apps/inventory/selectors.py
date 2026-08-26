"""Inventory reads that always require a validated tenant context.

Every projection of quantity lives here so the API, the web table and the
mobile list can never disagree about what «disponible» means.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from django.db.models import Count, F, IntegerField, Q, QuerySet, Sum, Value
from django.db.models.functions import Coalesce, Greatest

from apps.organisations.selectors import TenantContext
from apps.shipping.models import Shipment
from tenda.errors import DomainError, ResourceNotFound
from tenda.pagination import Page, paginate

from .models import CustomFieldDefinition, Inventory, InventoryAlert, Product, StockMovement

#: Sortable columns are limited to indexed or projected values.
SORTABLE_FIELDS: dict[str, str] = {
    "name": "name",
    "createdAt": "created_at",
    "updatedAt": "updated_at",
    "salePrice": "sale_price",
    "onHand": "on_hand",
    "available": "available",
}

STOCK_STATES = frozenset({"available", "out_of_stock", "reserved"})
SETTLED_FULFILMENT_STATUSES = frozenset(
    {
        Shipment.Status.DELIVERED,
        Shipment.Status.CLOSED,
        Shipment.Status.RETURNED,
        Shipment.Status.CANCELLED,
    }
)


def inventory_for_tenant(context: TenantContext, public_id: uuid.UUID) -> Inventory:
    inventory = Inventory.objects.filter(
        public_id=public_id,
        organisation=context.organisation,
        is_active=True,
    ).first()
    if inventory is None:
        raise ResourceNotFound()
    return inventory


def custom_fields_for_inventory(context: TenantContext) -> QuerySet[CustomFieldDefinition]:
    return CustomFieldDefinition.objects.filter(inventory=context.inventory)


def active_custom_fields(context: TenantContext) -> list[CustomFieldDefinition]:
    return list(custom_fields_for_inventory(context).filter(is_active=True))


def custom_field_for_context(
    context: TenantContext,
    public_id: uuid.UUID,
) -> CustomFieldDefinition:
    definition = custom_fields_for_inventory(context).filter(public_id=public_id).first()
    if definition is None:
        raise ResourceNotFound()
    return definition


def products_for_inventory(context: TenantContext) -> QuerySet[Product]:
    """The shared read model: on_hand, reserved, available and fulfilment."""

    return (
        Product.objects.filter(inventory=context.inventory)
        .select_related("balance", "primary_image")
        .annotate(
            on_hand=Coalesce(F("balance__on_hand"), Value(0)),
            reserved=Coalesce(F("balance__reserved"), Value(0)),
            available=Greatest(
                Coalesce(F("balance__on_hand"), Value(0))
                - Coalesce(F("balance__reserved"), Value(0)),
                Value(0),
            ),
            active_fulfilment=Coalesce(
                Sum(
                    "order_items__quantity",
                    filter=Q(
                        order_items__order__status__in=("paid", "refunded"),
                    )
                    & (
                        Q(order_items__order__shipment__isnull=True)
                        | ~Q(order_items__order__shipment__status__in=(SETTLED_FULFILMENT_STATUSES))
                    ),
                    output_field=IntegerField(),
                ),
                Value(0),
            ),
        )
    )


def product_for_context(context: TenantContext, public_id: uuid.UUID) -> Product:
    product = products_for_inventory(context).filter(public_id=public_id).first()
    if product is None:
        raise ResourceNotFound()
    return product


@dataclass(frozen=True, slots=True)
class ProductFilters:
    search: str = ""
    catalog_statuses: tuple[str, ...] = ()
    stock_states: tuple[str, ...] = ()
    attributes: tuple[tuple[str, str], ...] = field(default_factory=tuple)
    include_archived: bool = False


def _attribute_filter(
    context: TenantContext,
    attributes: tuple[tuple[str, str], ...],
) -> Q:
    if not attributes:
        return Q()
    filterable = {
        definition.key for definition in active_custom_fields(context) if definition.is_filterable
    }
    condition = Q()
    for key, value in attributes:
        if key not in filterable:
            raise DomainError(
                "UNKNOWN_CUSTOM_FIELD",
                "Hay filtros que no existen en este inventario.",
                field_errors={f"filter.{key}": ["Esta columna no permite filtrar."]},
            )
        condition &= Q(**{f"extra_attributes__{key}": value})
    return condition


def filtered_products(
    context: TenantContext,
    filters: ProductFilters,
) -> QuerySet[Product]:
    queryset = products_for_inventory(context)
    if not filters.include_archived and not filters.catalog_statuses:
        queryset = queryset.exclude(catalog_status=Product.CatalogStatus.ARCHIVED)
    if filters.catalog_statuses:
        queryset = queryset.filter(catalog_status__in=filters.catalog_statuses)
    search = filters.search.strip()
    if search:
        queryset = queryset.filter(name__icontains=search)
    states = {state for state in filters.stock_states if state in STOCK_STATES}
    if states:
        condition = Q()
        if "available" in states:
            condition |= Q(available__gt=0)
        if "out_of_stock" in states:
            condition |= Q(available=0)
        if "reserved" in states:
            condition |= Q(reserved__gt=0)
        queryset = queryset.filter(condition)
    return queryset.filter(_attribute_filter(context, filters.attributes))


def paginated_products(
    context: TenantContext,
    *,
    filters: ProductFilters,
    sort: str = "name",
    descending: bool = False,
    after: str | None = None,
    first: int | None = None,
) -> Page[Product]:
    column = SORTABLE_FIELDS.get(sort)
    if column is None:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"sort": ["Ese orden no está disponible."]},
        )
    return paginate(
        filtered_products(context, filters),
        cursor_field=column,
        after=after,
        first=first,
        descending=descending,
    )


def stock_movements_for_product(
    context: TenantContext,
    *,
    product: Product,
    after: str | None = None,
    first: int | None = None,
) -> Page[StockMovement]:
    movements = StockMovement.objects.filter(
        inventory=context.inventory,
        product=product,
    ).select_related("actor")
    return paginate(
        movements,
        cursor_field="created_at",
        after=after,
        first=first,
        descending=True,
    )


@dataclass(frozen=True, slots=True)
class InventorySummary:
    product_count: int
    archived_count: int
    on_hand: int
    reserved: int
    available: int
    out_of_stock_count: int
    low_stock_count: int


def inventory_summary(context: TenantContext) -> InventorySummary:
    active = products_for_inventory(context).exclude(catalog_status=Product.CatalogStatus.ARCHIVED)
    # Aliases differ from the annotation names so the filter below still
    # resolves against the per-product projection, not against the aggregate.
    totals: dict[str, Any] = active.aggregate(
        total_products=Count("pk"),
        total_on_hand=Coalesce(Sum("on_hand"), Value(0)),
        total_reserved=Coalesce(Sum("reserved"), Value(0)),
        total_available=Coalesce(Sum("available"), Value(0)),
        total_out_of_stock=Count("pk", filter=Q(available=0)),
    )
    archived = (
        Product.objects.filter(
            inventory=context.inventory,
            catalog_status=Product.CatalogStatus.ARCHIVED,
        )
        .values("pk")
        .count()
    )
    return InventorySummary(
        product_count=int(totals["total_products"]),
        archived_count=archived,
        on_hand=int(totals["total_on_hand"]),
        reserved=int(totals["total_reserved"]),
        available=int(totals["total_available"]),
        out_of_stock_count=int(totals["total_out_of_stock"]),
        low_stock_count=InventoryAlert.objects.filter(
            inventory=context.inventory,
            status=InventoryAlert.Status.ACTIVE,
            alert_type=InventoryAlert.AlertType.LOW_STOCK,
        ).count(),
    )


def recent_movements(context: TenantContext, *, limit: int = 5) -> list[StockMovement]:
    return list(
        StockMovement.objects.filter(inventory=context.inventory)
        .select_related("product", "actor")
        .order_by("-created_at", "-id")[:limit]
    )
