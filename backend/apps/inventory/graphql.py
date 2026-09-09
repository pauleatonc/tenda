"""Thin GraphQL contract for the inventory.

Adapters only translate; filters, projections and transactions belong to the
selectors and services of this app.
"""

from __future__ import annotations

import base64
import uuid
from decimal import Decimal
from typing import Any

import graphene
from django.db.models import Q
from graphql import GraphQLResolveInfo

from apps.media_assets.services import asset_content_url
from tenda.errors import DomainError, ResourceNotFound
from tenda.graphql import context_from_info, graphql_error, request_from_info
from tenda.pagination import Page, paginate

from .alerts import (
    active_stock_alerts,
    effective_low_stock_threshold,
    update_inventory_low_stock_threshold,
    update_product_low_stock_threshold,
)
from .bulk import (
    build_import_template,
    confirm_inventory_import,
    import_template_columns,
    inventory_export_download_url,
    inventory_export_for_context,
    inventory_exports_for_context,
    inventory_import_for_context,
    inventory_import_report_url,
    inventory_imports_for_context,
    preview_inventory_import,
    retry_inventory_export,
    retry_inventory_import,
    start_inventory_export,
    start_inventory_import,
)
from .media import (
    attach_product_media,
    product_media,
    remove_product_media,
    set_primary_product_media,
)
from .models import (
    CustomFieldDefinition,
    Inventory,
    InventoryAlert,
    InventoryExport,
    InventoryImport,
    Product,
    ProductMediaAttachment,
    StockMovement,
)
from .selectors import (
    SETTLED_FULFILMENT_STATUSES,
    InventorySummary,
    ProductFilters,
    active_custom_fields,
    custom_fields_for_inventory,
    inventory_summary,
    paginated_products,
    product_for_context,
    recent_movements,
    stock_movements_for_product,
)
from .services import (
    UNSET,
    archive_product,
    create_custom_field,
    create_product,
    record_stock_movement,
    reorder_custom_fields,
    restore_product,
    update_custom_field,
    update_product,
)


def _correlation_id(info: GraphQLResolveInfo) -> str:
    return str(getattr(info.context, "correlation_id", ""))


def _uuid_or_not_found(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except ValueError as exc:
        raise ResourceNotFound() from exc


def _money(value: Decimal | None) -> str | None:
    """CLP travels as a string: it is integral and never a float."""

    return None if value is None else format(value, "f")


class PageInfoType(graphene.ObjectType):  # type: ignore[misc]
    has_next_page = graphene.Boolean(required=True)
    end_cursor = graphene.String(required=True)


class CustomFieldOptionType(graphene.ObjectType):  # type: ignore[misc]
    key = graphene.String(required=True)
    label = graphene.String(required=True)


class CustomFieldType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    key = graphene.String(required=True)
    label = graphene.String(required=True)
    field_type = graphene.String(required=True)
    options = graphene.List(graphene.NonNull(CustomFieldOptionType), required=True)
    help_text = graphene.String(required=True)
    is_required = graphene.Boolean(required=True)
    is_visible = graphene.Boolean(required=True)
    is_filterable = graphene.Boolean(required=True)
    is_active = graphene.Boolean(required=True)
    position = graphene.Int(required=True)

    @staticmethod
    def resolve_id(root: CustomFieldDefinition, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_options(
        root: CustomFieldDefinition,
        _info: GraphQLResolveInfo,
    ) -> list[dict[str, str]]:
        return [option for option in (root.options or []) if isinstance(option, dict)]


class InventorySchemaType(graphene.ObjectType):  # type: ignore[misc]
    inventory_id = graphene.ID(required=True)
    name = graphene.String(required=True)
    low_stock_threshold = graphene.Int(required=True)
    max_active_fields = graphene.Int(required=True)
    fields = graphene.List(graphene.NonNull(CustomFieldType), required=True)

    @staticmethod
    def resolve_inventory_id(root: dict[str, Any], _info: GraphQLResolveInfo) -> str:
        inventory: Inventory = root["inventory"]
        return str(inventory.public_id)

    @staticmethod
    def resolve_name(root: dict[str, Any], _info: GraphQLResolveInfo) -> str:
        inventory: Inventory = root["inventory"]
        return inventory.name

    @staticmethod
    def resolve_low_stock_threshold(
        root: dict[str, Any],
        _info: GraphQLResolveInfo,
    ) -> int:
        inventory: Inventory = root["inventory"]
        return inventory.low_stock_threshold

    @staticmethod
    def resolve_max_active_fields(root: dict[str, Any], _info: GraphQLResolveInfo) -> int:
        del root
        return CustomFieldDefinition.MAX_ACTIVE_PER_INVENTORY

    @staticmethod
    def resolve_fields(
        root: dict[str, Any],
        _info: GraphQLResolveInfo,
    ) -> list[CustomFieldDefinition]:
        return list(root["fields"])


class ProductStockType(graphene.ObjectType):  # type: ignore[misc]
    on_hand = graphene.Int(required=True)
    reserved = graphene.Int(required=True)
    available = graphene.Int(required=True)
    active_fulfilment = graphene.Int(required=True)

    @staticmethod
    def resolve_on_hand(root: Product, _info: GraphQLResolveInfo) -> int:
        return int(getattr(root, "on_hand", 0))

    @staticmethod
    def resolve_reserved(root: Product, _info: GraphQLResolveInfo) -> int:
        return int(getattr(root, "reserved", 0))

    @staticmethod
    def resolve_available(root: Product, _info: GraphQLResolveInfo) -> int:
        return int(getattr(root, "available", 0))

    @staticmethod
    def resolve_active_fulfilment(root: Product, _info: GraphQLResolveInfo) -> int:
        return int(getattr(root, "active_fulfilment", 0))


class ProductMediaType(graphene.ObjectType):  # type: ignore[misc]
    asset_id = graphene.ID(required=True)
    url = graphene.String(required=True)
    thumbnail_url = graphene.String(required=True)
    medium_url = graphene.String(required=True)
    large_url = graphene.String(required=True)
    content_type = graphene.String(required=True)
    original_name = graphene.String(required=True)
    is_primary = graphene.Boolean(required=True)
    position = graphene.Int(required=True)
    created_at = graphene.DateTime(required=True)

    @staticmethod
    def resolve_asset_id(root: ProductMediaAttachment, _info: GraphQLResolveInfo) -> str:
        return str(root.asset.public_id)

    @staticmethod
    def resolve_url(root: ProductMediaAttachment, _info: GraphQLResolveInfo) -> str:
        return asset_content_url(root.asset, variant="medium") or ""

    @staticmethod
    def resolve_thumbnail_url(root: ProductMediaAttachment, _info: GraphQLResolveInfo) -> str:
        return asset_content_url(root.asset, variant="thumbnail") or ""

    @staticmethod
    def resolve_medium_url(root: ProductMediaAttachment, _info: GraphQLResolveInfo) -> str:
        return asset_content_url(root.asset, variant="medium") or ""

    @staticmethod
    def resolve_large_url(root: ProductMediaAttachment, _info: GraphQLResolveInfo) -> str:
        return asset_content_url(root.asset, variant="large") or ""

    @staticmethod
    def resolve_content_type(
        root: ProductMediaAttachment,
        _info: GraphQLResolveInfo,
    ) -> str:
        return root.asset.content_type

    @staticmethod
    def resolve_original_name(
        root: ProductMediaAttachment,
        _info: GraphQLResolveInfo,
    ) -> str:
        return root.asset.original_name

    @staticmethod
    def resolve_is_primary(
        root: ProductMediaAttachment,
        _info: GraphQLResolveInfo,
    ) -> bool:
        return root.product.primary_image_id == root.asset_id


class ProductType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    name = graphene.String(required=True)
    catalog_status = graphene.String(required=True)
    purchase_price = graphene.String()
    sale_price = graphene.String()
    currency = graphene.String(required=True)
    extra_attributes = graphene.JSONString(required=True)
    stock = graphene.Field(ProductStockType, required=True)
    low_stock_threshold = graphene.Int()
    effective_low_stock_threshold = graphene.Int(required=True)
    media = graphene.List(graphene.NonNull(ProductMediaType), required=True)
    created_at = graphene.DateTime(required=True)
    updated_at = graphene.DateTime(required=True)
    archived_at = graphene.DateTime()

    @staticmethod
    def resolve_id(root: Product, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_purchase_price(root: Product, _info: GraphQLResolveInfo) -> str | None:
        return _money(root.purchase_price)

    @staticmethod
    def resolve_sale_price(root: Product, _info: GraphQLResolveInfo) -> str | None:
        return _money(root.sale_price)

    @staticmethod
    def resolve_extra_attributes(root: Product, _info: GraphQLResolveInfo) -> dict[str, Any]:
        return dict(root.extra_attributes or {})

    @staticmethod
    def resolve_stock(root: Product, _info: GraphQLResolveInfo) -> Product:
        return root

    @staticmethod
    def resolve_effective_low_stock_threshold(
        root: Product,
        _info: GraphQLResolveInfo,
    ) -> int:
        return effective_low_stock_threshold(root)

    @staticmethod
    def resolve_media(
        root: Product,
        info: GraphQLResolveInfo,
    ) -> list[ProductMediaAttachment]:
        return list(product_media(context_from_info(info), product=root))


class ProductConnectionType(graphene.ObjectType):  # type: ignore[misc]
    nodes = graphene.List(graphene.NonNull(ProductType), required=True)
    page_info = graphene.Field(PageInfoType, required=True)
    total_count = graphene.Int(required=True)


class StockMovementType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    product_id = graphene.ID(required=True)
    product_name = graphene.String(required=True)
    movement_type = graphene.String(required=True)
    quantity = graphene.Int(required=True)
    balance_after = graphene.Int(required=True)
    reason = graphene.String(required=True)
    note = graphene.String(required=True)
    actor_name = graphene.String(required=True)
    reference_type = graphene.String(required=True)
    reference_id = graphene.String(required=True)
    created_at = graphene.DateTime(required=True)

    @staticmethod
    def resolve_id(root: StockMovement, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_product_id(root: StockMovement, _info: GraphQLResolveInfo) -> str:
        return str(root.product.public_id)

    @staticmethod
    def resolve_product_name(root: StockMovement, _info: GraphQLResolveInfo) -> str:
        return root.product.name

    @staticmethod
    def resolve_actor_name(root: StockMovement, _info: GraphQLResolveInfo) -> str:
        if root.actor is None:
            return "Sistema"
        profile = getattr(root.actor, "profile", None)
        return getattr(profile, "full_name", "") or "Persona del equipo"

    @staticmethod
    def resolve_reference_id(root: StockMovement, _info: GraphQLResolveInfo) -> str:
        return root.reference_public_id


class StockMovementConnectionType(graphene.ObjectType):  # type: ignore[misc]
    nodes = graphene.List(graphene.NonNull(StockMovementType), required=True)
    page_info = graphene.Field(PageInfoType, required=True)
    total_count = graphene.Int(required=True)


class StockBreakdownLineType(graphene.ObjectType):  # type: ignore[misc]
    """One line of the expanded row. Available units are always aggregated."""

    kind = graphene.String(required=True)
    label = graphene.String(required=True)
    quantity = graphene.Int(required=True)
    effective_price = graphene.String()
    buyer_name = graphene.String()
    status = graphene.String()
    reference_id = graphene.ID()


class StockBreakdownType(graphene.ObjectType):  # type: ignore[misc]
    product_id = graphene.ID(required=True)
    available = graphene.Int(required=True)
    lines = graphene.List(graphene.NonNull(StockBreakdownLineType), required=True)
    page_info = graphene.Field(PageInfoType, required=True)
    total_count = graphene.Int(required=True)


class ProductOrderType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    status = graphene.String(required=True)
    quantity = graphene.Int(required=True)
    unit_sale_price = graphene.String()
    buyer_name = graphene.String()
    created_at = graphene.DateTime(required=True)

    @staticmethod
    def resolve_id(root: Any, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_status(root: Any, _info: GraphQLResolveInfo) -> str:
        return str(root.order.status)

    @staticmethod
    def resolve_unit_sale_price(root: Any, _info: GraphQLResolveInfo) -> str:
        return str(root.unit_sale_price)

    @staticmethod
    def resolve_buyer_name(root: Any, _info: GraphQLResolveInfo) -> str | None:
        buyer = getattr(root.order, "buyer", None)
        return str(buyer.name) if buyer is not None else None

    @staticmethod
    def resolve_created_at(root: Any, _info: GraphQLResolveInfo) -> Any:
        return root.order.created_at


class ProductShipmentType(graphene.ObjectType):  # type: ignore[misc]
    """Populated in T3."""

    id = graphene.ID(required=True)
    status = graphene.String(required=True)
    quantity = graphene.Int(required=True)
    created_at = graphene.DateTime(required=True)


class ProductOrderConnectionType(graphene.ObjectType):  # type: ignore[misc]
    nodes = graphene.List(graphene.NonNull(ProductOrderType), required=True)
    page_info = graphene.Field(PageInfoType, required=True)
    total_count = graphene.Int(required=True)
    available_from_stage = graphene.String(required=True)


class ProductShipmentConnectionType(graphene.ObjectType):  # type: ignore[misc]
    nodes = graphene.List(graphene.NonNull(ProductShipmentType), required=True)
    page_info = graphene.Field(PageInfoType, required=True)
    total_count = graphene.Int(required=True)
    available_from_stage = graphene.String(required=True)


class InventoryAlertType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    product_id = graphene.ID(required=True)
    product_name = graphene.String(required=True)
    alert_type = graphene.String(required=True)
    status = graphene.String(required=True)
    threshold = graphene.Int(required=True)
    available_quantity = graphene.Int(required=True)
    opened_at = graphene.DateTime(required=True)
    updated_at = graphene.DateTime(required=True)

    @staticmethod
    def resolve_id(root: InventoryAlert, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_product_id(root: InventoryAlert, _info: GraphQLResolveInfo) -> str:
        return str(root.product.public_id)

    @staticmethod
    def resolve_product_name(root: InventoryAlert, _info: GraphQLResolveInfo) -> str:
        return root.product.name


class InventoryImportType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    status = graphene.String(required=True)
    progress = graphene.Int(required=True)
    source_file_name = graphene.String(required=True)
    headers = graphene.JSONString(required=True)
    preview_rows = graphene.JSONString(required=True)
    mapping = graphene.JSONString(required=True)
    row_errors = graphene.JSONString(required=True)
    total_rows = graphene.Int(required=True)
    processed_rows = graphene.Int(required=True)
    created_count = graphene.Int(required=True)
    error_count = graphene.Int(required=True)
    error_code = graphene.String(required=True)
    report_url = graphene.String()
    created_at = graphene.DateTime(required=True)
    completed_at = graphene.DateTime()

    @staticmethod
    def resolve_id(root: InventoryImport, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_source_file_name(
        root: InventoryImport,
        _info: GraphQLResolveInfo,
    ) -> str:
        return root.source_asset.original_name

    @staticmethod
    def resolve_report_url(
        root: InventoryImport,
        info: GraphQLResolveInfo,
    ) -> str | None:
        return inventory_import_report_url(context=context_from_info(info), job=root)


class InventoryImportColumnType(graphene.ObjectType):  # type: ignore[misc]
    destination = graphene.String(required=True)
    header = graphene.String(required=True)
    required = graphene.Boolean(required=True)


class InventoryImportTemplateType(graphene.ObjectType):  # type: ignore[misc]
    file_name = graphene.String(required=True)
    content_type = graphene.String(required=True)
    content_base64 = graphene.String(required=True)
    columns = graphene.List(graphene.NonNull(InventoryImportColumnType), required=True)


class InventoryExportType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    status = graphene.String(required=True)
    file_format = graphene.String(required=True)
    progress = graphene.Int(required=True)
    row_count = graphene.Int(required=True)
    error_code = graphene.String(required=True)
    download_url = graphene.String()
    expires_at = graphene.DateTime()
    created_at = graphene.DateTime(required=True)
    completed_at = graphene.DateTime()

    @staticmethod
    def resolve_id(root: InventoryExport, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_download_url(
        root: InventoryExport,
        info: GraphQLResolveInfo,
    ) -> str | None:
        return inventory_export_download_url(context=context_from_info(info), job=root)


class InventoryDashboardType(graphene.ObjectType):  # type: ignore[misc]
    product_count = graphene.Int(required=True)
    archived_count = graphene.Int(required=True)
    on_hand = graphene.Int(required=True)
    reserved = graphene.Int(required=True)
    available = graphene.Int(required=True)
    out_of_stock_count = graphene.Int(required=True)
    low_stock_count = graphene.Int(required=True)
    alerts = graphene.List(graphene.NonNull(InventoryAlertType), required=True)
    recent_movements = graphene.List(graphene.NonNull(StockMovementType), required=True)

    @staticmethod
    def resolve_recent_movements(
        root: dict[str, Any],
        _info: GraphQLResolveInfo,
    ) -> list[StockMovement]:
        return list(root["recent_movements"])

    @staticmethod
    def resolve_product_count(root: dict[str, Any], _info: GraphQLResolveInfo) -> int:
        summary: InventorySummary = root["summary"]
        return summary.product_count

    @staticmethod
    def resolve_archived_count(root: dict[str, Any], _info: GraphQLResolveInfo) -> int:
        summary: InventorySummary = root["summary"]
        return summary.archived_count

    @staticmethod
    def resolve_on_hand(root: dict[str, Any], _info: GraphQLResolveInfo) -> int:
        summary: InventorySummary = root["summary"]
        return summary.on_hand

    @staticmethod
    def resolve_reserved(root: dict[str, Any], _info: GraphQLResolveInfo) -> int:
        summary: InventorySummary = root["summary"]
        return summary.reserved

    @staticmethod
    def resolve_available(root: dict[str, Any], _info: GraphQLResolveInfo) -> int:
        summary: InventorySummary = root["summary"]
        return summary.available

    @staticmethod
    def resolve_out_of_stock_count(root: dict[str, Any], _info: GraphQLResolveInfo) -> int:
        summary: InventorySummary = root["summary"]
        return summary.out_of_stock_count

    @staticmethod
    def resolve_low_stock_count(root: dict[str, Any], _info: GraphQLResolveInfo) -> int:
        summary: InventorySummary = root["summary"]
        return summary.low_stock_count

    @staticmethod
    def resolve_alerts(
        root: dict[str, Any],
        _info: GraphQLResolveInfo,
    ) -> list[InventoryAlert]:
        return list(root["alerts"])


class ProductAttributeFilterInput(graphene.InputObjectType):  # type: ignore[misc]
    key = graphene.String(required=True)
    value = graphene.String(required=True)


class ProductFilterInput(graphene.InputObjectType):  # type: ignore[misc]
    search = graphene.String()
    catalog_statuses = graphene.List(graphene.NonNull(graphene.String))
    stock_states = graphene.List(graphene.NonNull(graphene.String))
    attributes = graphene.List(graphene.NonNull(ProductAttributeFilterInput))
    include_archived = graphene.Boolean()


def _filters_from_input(payload: dict[str, Any] | None) -> ProductFilters:
    data = payload or {}
    attributes = tuple(
        (str(item.get("key", "")), str(item.get("value", "")))
        for item in (data.get("attributes") or [])
    )
    return ProductFilters(
        search=str(data.get("search") or ""),
        catalog_statuses=tuple(data.get("catalog_statuses") or ()),
        stock_states=tuple(data.get("stock_states") or ()),
        attributes=attributes,
        include_archived=bool(data.get("include_archived")),
    )


def _page_info(page: Page[Any]) -> dict[str, Any]:
    return {"has_next_page": page.has_next_page, "end_cursor": page.end_cursor}


class CustomFieldOptionInput(graphene.InputObjectType):  # type: ignore[misc]
    key = graphene.String()
    label = graphene.String(required=True)


class CreateCustomFieldInput(graphene.InputObjectType):  # type: ignore[misc]
    label = graphene.String(required=True)
    field_type = graphene.String(required=True)
    key = graphene.String()
    options = graphene.List(graphene.NonNull(CustomFieldOptionInput))
    help_text = graphene.String()
    is_required = graphene.Boolean()
    is_visible = graphene.Boolean()
    is_filterable = graphene.Boolean()
    default_value = graphene.String()


class CreateCustomField(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        input = graphene.Argument(CreateCustomFieldInput, required=True)

    field = graphene.Field(CustomFieldType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        input: dict[str, Any],
    ) -> CreateCustomField:
        try:
            definition = create_custom_field(
                context=context_from_info(info),
                label=str(input.get("label", "")),
                field_type=str(input.get("field_type", "")),
                key=str(input.get("key") or ""),
                options=input.get("options"),
                help_text=str(input.get("help_text") or ""),
                is_required=bool(input.get("is_required")),
                is_visible=input.get("is_visible") is not False,
                is_filterable=bool(input.get("is_filterable")),
                default_value=input.get("default_value"),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return CreateCustomField(field=definition)


class UpdateCustomFieldInput(graphene.InputObjectType):  # type: ignore[misc]
    field_id = graphene.ID(required=True)
    label = graphene.String()
    options = graphene.List(graphene.NonNull(CustomFieldOptionInput))
    help_text = graphene.String()
    is_required = graphene.Boolean()
    is_visible = graphene.Boolean()
    is_filterable = graphene.Boolean()
    is_active = graphene.Boolean()
    default_value = graphene.String()


class UpdateCustomField(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        input = graphene.Argument(UpdateCustomFieldInput, required=True)

    field = graphene.Field(CustomFieldType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        input: dict[str, Any],
    ) -> UpdateCustomField:
        try:
            definition = update_custom_field(
                context=context_from_info(info),
                field_id=_uuid_or_not_found(input.get("field_id")),
                label=input.get("label"),
                options=input.get("options"),
                help_text=input.get("help_text"),
                is_required=input.get("is_required"),
                is_visible=input.get("is_visible"),
                is_filterable=input.get("is_filterable"),
                is_active=input.get("is_active"),
                default_value=input.get("default_value"),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return UpdateCustomField(field=definition)


class ReorderCustomFields(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        field_ids = graphene.List(graphene.NonNull(graphene.ID), required=True)

    fields = graphene.List(graphene.NonNull(CustomFieldType), required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        field_ids: list[str],
    ) -> ReorderCustomFields:
        try:
            ordered = reorder_custom_fields(
                context=context_from_info(info),
                field_ids=[_uuid_or_not_found(item) for item in field_ids],
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return ReorderCustomFields(fields=ordered)


class CreateProductInput(graphene.InputObjectType):  # type: ignore[misc]
    name = graphene.String(required=True)
    catalog_status = graphene.String()
    purchase_price = graphene.String()
    sale_price = graphene.String()
    extra_attributes = graphene.JSONString()
    initial_quantity = graphene.Int()
    reason = graphene.String()
    note = graphene.String()
    idempotency_key = graphene.String(required=True)


class CreateProduct(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        input = graphene.Argument(CreateProductInput, required=True)

    product = graphene.Field(ProductType, required=True)
    movement = graphene.Field(StockMovementType)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        input: dict[str, Any],
    ) -> CreateProduct:
        try:
            context = context_from_info(info)
            result = create_product(
                context=context,
                name=str(input.get("name", "")),
                catalog_status=str(input.get("catalog_status") or Product.CatalogStatus.ACTIVE),
                purchase_price=input.get("purchase_price"),
                sale_price=input.get("sale_price"),
                extra_attributes=input.get("extra_attributes"),
                initial_quantity=input.get("initial_quantity") or 0,
                reason=str(input.get("reason") or ""),
                note=str(input.get("note") or ""),
                idempotency_key=str(input.get("idempotency_key", "")),
                correlation_id=_correlation_id(info),
            )
            product = product_for_context(context, result.product.public_id)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return CreateProduct(
            product=product,
            movement=result.movement,
            replayed=result.replayed,
        )


class UpdateProductInput(graphene.InputObjectType):  # type: ignore[misc]
    product_id = graphene.ID(required=True)
    name = graphene.String()
    catalog_status = graphene.String()
    purchase_price = graphene.String()
    sale_price = graphene.String()
    clear_purchase_price = graphene.Boolean()
    clear_sale_price = graphene.Boolean()
    extra_attributes = graphene.JSONString()


class UpdateProduct(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        input = graphene.Argument(UpdateProductInput, required=True)

    product = graphene.Field(ProductType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        input: dict[str, Any],
    ) -> UpdateProduct:
        try:
            context = context_from_info(info)
            # A missing price means "leave it as is"; clearing is explicit.
            purchase = input.get("purchase_price")
            sale = input.get("sale_price")
            purchase = UNSET if purchase is None else purchase
            sale = UNSET if sale is None else sale
            if input.get("clear_purchase_price"):
                purchase = None
            if input.get("clear_sale_price"):
                sale = None
            updated = update_product(
                context=context,
                product_id=_uuid_or_not_found(input.get("product_id")),
                name=input.get("name"),
                catalog_status=input.get("catalog_status"),
                purchase_price=purchase,
                sale_price=sale,
                extra_attributes=input.get("extra_attributes"),
                correlation_id=_correlation_id(info),
            )
            product = product_for_context(context, updated.public_id)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return UpdateProduct(product=product)


class RecordStockMovementInput(graphene.InputObjectType):  # type: ignore[misc]
    product_id = graphene.ID(required=True)
    movement_type = graphene.String(required=True)
    quantity = graphene.Int(required=True)
    reason = graphene.String()
    note = graphene.String()
    corrects_id = graphene.ID()
    idempotency_key = graphene.String(required=True)


class RecordStockMovement(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        input = graphene.Argument(RecordStockMovementInput, required=True)

    movement = graphene.Field(StockMovementType, required=True)
    product = graphene.Field(ProductType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        input: dict[str, Any],
    ) -> RecordStockMovement:
        try:
            context = context_from_info(info)
            corrects = input.get("corrects_id")
            result = record_stock_movement(
                context=context,
                product_id=_uuid_or_not_found(input.get("product_id")),
                movement_type=str(input.get("movement_type", "")),
                quantity=input.get("quantity"),
                reason=str(input.get("reason") or ""),
                note=str(input.get("note") or ""),
                corrects_id=_uuid_or_not_found(corrects) if corrects else None,
                idempotency_key=str(input.get("idempotency_key", "")),
                correlation_id=_correlation_id(info),
            )
            product = product_for_context(context, result.movement.product.public_id)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RecordStockMovement(
            movement=result.movement,
            product=product,
            replayed=result.replayed,
        )


class ArchiveProduct(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        product_id = graphene.ID(required=True)

    product = graphene.Field(ProductType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        product_id: str,
    ) -> ArchiveProduct:
        try:
            context = context_from_info(info)
            archived = archive_product(
                context=context,
                product_id=_uuid_or_not_found(product_id),
                correlation_id=_correlation_id(info),
            )
            product = product_for_context(context, archived.public_id)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return ArchiveProduct(product=product)


class RestoreProduct(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        product_id = graphene.ID(required=True)

    product = graphene.Field(ProductType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        product_id: str,
    ) -> RestoreProduct:
        try:
            context = context_from_info(info)
            restored = restore_product(
                context=context,
                product_id=_uuid_or_not_found(product_id),
                correlation_id=_correlation_id(info),
            )
            product = product_for_context(context, restored.public_id)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RestoreProduct(product=product)


class AttachProductMedia(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        product_id = graphene.ID(required=True)
        asset_id = graphene.ID(required=True)
        make_primary = graphene.Boolean()

    media = graphene.Field(ProductMediaType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        product_id: str,
        asset_id: str,
        make_primary: bool = False,
    ) -> AttachProductMedia:
        try:
            attachment = attach_product_media(
                context=context_from_info(info),
                product_id=_uuid_or_not_found(product_id),
                asset_id=_uuid_or_not_found(asset_id),
                make_primary=make_primary,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return AttachProductMedia(media=attachment)


class SetPrimaryProductMedia(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        product_id = graphene.ID(required=True)
        asset_id = graphene.ID(required=True)

    media = graphene.Field(ProductMediaType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        product_id: str,
        asset_id: str,
    ) -> SetPrimaryProductMedia:
        try:
            attachment = set_primary_product_media(
                context=context_from_info(info),
                product_id=_uuid_or_not_found(product_id),
                asset_id=_uuid_or_not_found(asset_id),
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return SetPrimaryProductMedia(media=attachment)


class RemoveProductMedia(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        product_id = graphene.ID(required=True)
        asset_id = graphene.ID(required=True)

    product = graphene.Field(ProductType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        product_id: str,
        asset_id: str,
    ) -> RemoveProductMedia:
        try:
            context = context_from_info(info)
            product = remove_product_media(
                context=context,
                product_id=_uuid_or_not_found(product_id),
                asset_id=_uuid_or_not_found(asset_id),
                correlation_id=_correlation_id(info),
            )
            product = product_for_context(context, product.public_id)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RemoveProductMedia(product=product)


class StartInventoryImport(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        asset_id = graphene.ID(required=True)

    import_job = graphene.Field(InventoryImportType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        asset_id: str,
    ) -> StartInventoryImport:
        try:
            if request_from_info(info).headers.get("X-Tenda-Client") == "mobile":
                raise DomainError(
                    "IMPORT_WEB_ONLY",
                    "La importación por planilla Excel se hace en la versión web.",
                    status=403,
                )
            job = start_inventory_import(
                context=context_from_info(info),
                asset_id=_uuid_or_not_found(asset_id),
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return StartInventoryImport(import_job=job)


class PreviewInventoryImport(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        import_id = graphene.ID(required=True)
        mapping = graphene.JSONString(required=True)

    import_job = graphene.Field(InventoryImportType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        import_id: str,
        mapping: Any,
    ) -> PreviewInventoryImport:
        try:
            if not isinstance(mapping, dict):
                raise DomainError(
                    "INVALID_IMPORT_MAPPING",
                    "Revisa el mapeo de columnas.",
                )
            job = preview_inventory_import(
                context=context_from_info(info),
                import_id=_uuid_or_not_found(import_id),
                mapping=mapping,
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return PreviewInventoryImport(import_job=job)


class ConfirmInventoryImport(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        import_id = graphene.ID(required=True)
        idempotency_key = graphene.String(required=True)

    import_job = graphene.Field(InventoryImportType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        import_id: str,
        idempotency_key: str,
    ) -> ConfirmInventoryImport:
        try:
            job, replayed = confirm_inventory_import(
                context=context_from_info(info),
                import_id=_uuid_or_not_found(import_id),
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return ConfirmInventoryImport(import_job=job, replayed=replayed)


class RetryInventoryImport(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        import_id = graphene.ID(required=True)

    import_job = graphene.Field(InventoryImportType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        import_id: str,
    ) -> RetryInventoryImport:
        try:
            job = retry_inventory_import(
                context=context_from_info(info),
                import_id=_uuid_or_not_found(import_id),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RetryInventoryImport(import_job=job)


class StartInventoryExport(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        file_format = graphene.String(required=True)
        filter = graphene.Argument(ProductFilterInput)
        idempotency_key = graphene.String(required=True)

    export_job = graphene.Field(InventoryExportType, required=True)
    replayed = graphene.Boolean(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        file_format: str,
        idempotency_key: str,
        filter: dict[str, Any] | None = None,
    ) -> StartInventoryExport:
        data = filter or {}
        payload = {
            "search": data.get("search"),
            "catalogStatuses": list(data.get("catalog_statuses") or ()),
            "stockStates": list(data.get("stock_states") or ()),
            "attributes": [
                {"key": str(item.get("key", "")), "value": str(item.get("value", ""))}
                for item in (data.get("attributes") or ())
            ],
            "includeArchived": bool(data.get("include_archived")),
        }
        try:
            job, replayed = start_inventory_export(
                context=context_from_info(info),
                file_format=file_format,
                filters=payload,
                idempotency_key=idempotency_key,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return StartInventoryExport(export_job=job, replayed=replayed)


class RetryInventoryExport(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        export_id = graphene.ID(required=True)

    export_job = graphene.Field(InventoryExportType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        export_id: str,
    ) -> RetryInventoryExport:
        try:
            job = retry_inventory_export(
                context=context_from_info(info),
                export_id=_uuid_or_not_found(export_id),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RetryInventoryExport(export_job=job)


class UpdateInventoryLowStockThreshold(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        threshold = graphene.Int(required=True)

    threshold = graphene.Int(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        threshold: int,
    ) -> UpdateInventoryLowStockThreshold:
        try:
            value = update_inventory_low_stock_threshold(
                context=context_from_info(info),
                threshold=threshold,
                correlation_id=_correlation_id(info),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return UpdateInventoryLowStockThreshold(threshold=value)


class UpdateProductLowStockThreshold(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        product_id = graphene.ID(required=True)
        threshold = graphene.Int()
        clear = graphene.Boolean()

    product = graphene.Field(ProductType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        product_id: str,
        threshold: int | None = None,
        clear: bool = False,
    ) -> UpdateProductLowStockThreshold:
        try:
            context = context_from_info(info)
            product = update_product_low_stock_threshold(
                context=context,
                product_id=_uuid_or_not_found(product_id),
                threshold=None if clear else threshold,
                correlation_id=_correlation_id(info),
            )
            product = product_for_context(context, product.public_id)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return UpdateProductLowStockThreshold(product=product)


class InventoryQuery(graphene.ObjectType):  # type: ignore[misc]
    inventory_schema = graphene.Field(
        InventorySchemaType,
        required=True,
        include_inactive=graphene.Boolean(),
    )
    inventory_dashboard = graphene.Field(InventoryDashboardType, required=True)
    products = graphene.Field(
        ProductConnectionType,
        required=True,
        filter=graphene.Argument(ProductFilterInput),
        sort=graphene.String(),
        descending=graphene.Boolean(),
        first=graphene.Int(),
        after=graphene.String(),
    )
    product = graphene.Field(ProductType, id=graphene.ID(required=True))
    product_stock_breakdown = graphene.Field(
        StockBreakdownType,
        required=True,
        product_id=graphene.ID(required=True),
        first=graphene.Int(),
        after=graphene.String(),
    )
    stock_movements = graphene.Field(
        StockMovementConnectionType,
        required=True,
        product_id=graphene.ID(required=True),
        first=graphene.Int(),
        after=graphene.String(),
    )
    product_orders = graphene.Field(
        ProductOrderConnectionType,
        required=True,
        product_id=graphene.ID(required=True),
        first=graphene.Int(),
        after=graphene.String(),
    )
    product_shipments = graphene.Field(
        ProductShipmentConnectionType,
        required=True,
        product_id=graphene.ID(required=True),
        first=graphene.Int(),
        after=graphene.String(),
    )
    inventory_alerts = graphene.List(
        graphene.NonNull(InventoryAlertType),
        required=True,
        limit=graphene.Int(),
    )
    inventory_import = graphene.Field(
        InventoryImportType,
        id=graphene.ID(required=True),
    )
    inventory_imports = graphene.List(
        graphene.NonNull(InventoryImportType),
        required=True,
    )
    inventory_export = graphene.Field(
        InventoryExportType,
        id=graphene.ID(required=True),
    )
    inventory_exports = graphene.List(
        graphene.NonNull(InventoryExportType),
        required=True,
    )
    inventory_import_template = graphene.Field(
        InventoryImportTemplateType,
        required=True,
    )

    @staticmethod
    def resolve_inventory_schema(
        _root: object,
        info: GraphQLResolveInfo,
        include_inactive: bool = False,
    ) -> dict[str, Any]:
        try:
            context = context_from_info(info)
            fields = (
                list(custom_fields_for_inventory(context))
                if include_inactive
                else active_custom_fields(context)
            )
            return {"inventory": context.inventory, "fields": fields}
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_inventory_dashboard(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> dict[str, Any]:
        try:
            context = context_from_info(info)
            return {
                "summary": inventory_summary(context),
                "recent_movements": recent_movements(context),
                "alerts": active_stock_alerts(context, limit=5),
            }
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_products(
        _root: object,
        info: GraphQLResolveInfo,
        filter: dict[str, Any] | None = None,
        sort: str = "name",
        descending: bool = False,
        first: int | None = None,
        after: str | None = None,
    ) -> dict[str, Any]:
        try:
            page = paginated_products(
                context_from_info(info),
                filters=_filters_from_input(filter),
                sort=sort,
                descending=descending,
                after=after,
                first=first,
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return {
            "nodes": page.items,
            "page_info": _page_info(page),
            "total_count": page.total_count,
        }

    @staticmethod
    def resolve_product(
        _root: object,
        info: GraphQLResolveInfo,
        id: str,
    ) -> Product:
        try:
            return product_for_context(context_from_info(info), _uuid_or_not_found(id))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_product_stock_breakdown(
        _root: object,
        info: GraphQLResolveInfo,
        product_id: str,
        first: int | None = None,
        after: str | None = None,
    ) -> dict[str, Any]:
        try:
            context = context_from_info(info)
            product = product_for_context(context, _uuid_or_not_found(product_id))
            from apps.sales.models import OrderItem, StockReservation

            reservations = list(
                StockReservation.objects.filter(
                    inventory=context.inventory,
                    product_id=product.pk,
                    consumed_at__isnull=True,
                    released_at__isnull=True,
                )
                .select_related("order", "order_item", "order__buyer")
                .order_by("created_at", "pk")
            )
            sold_items = list(
                OrderItem.objects.filter(
                    order__organisation=context.organisation,
                    order__inventory=context.inventory,
                    product_id=product.pk,
                    order__status__in=("paid", "refunded"),
                )
                .filter(
                    Q(order__shipment__isnull=True)
                    | ~Q(order__shipment__status__in=SETTLED_FULFILMENT_STATUSES)
                )
                .select_related("order", "order__buyer")
                .order_by("-order__paid_at", "pk")
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        available = int(getattr(product, "available", 0))
        lines = [
            {
                "kind": "available",
                "label": "Unidades disponibles",
                "quantity": available,
                "effective_price": _money(product.sale_price),
                "buyer_name": None,
                "status": None,
                "reference_id": None,
            }
        ]
        lines.extend(
            {
                "kind": "reserved",
                "label": "Reservado en venta",
                "quantity": reservation.quantity,
                "effective_price": _money(reservation.order_item.unit_sale_price),
                "buyer_name": getattr(
                    getattr(reservation.order, "buyer", None),
                    "name",
                    None,
                ),
                "status": reservation.order.status,
                "reference_id": str(reservation.order.public_id),
            }
            for reservation in reservations
        )
        lines.extend(
            {
                "kind": "sold",
                "label": "Vendido",
                "quantity": item.quantity,
                "effective_price": _money(item.unit_sale_price),
                "buyer_name": getattr(getattr(item.order, "buyer", None), "name", None),
                "status": item.order.status,
                "reference_id": str(item.order.public_id),
            }
            for item in sold_items
        )
        page_size = max(1, min(first or 25, 100))
        start = 0
        if after:
            try:
                start = int(after)
            except ValueError as exc:
                raise graphql_error(
                    info,
                    DomainError(
                        "INVALID_CURSOR",
                        "El cursor de paginación no es válido.",
                    ),
                ) from exc
        window = lines[start : start + page_size]
        end = start + len(window)
        return {
            "product_id": str(product.public_id),
            "available": available,
            "lines": window,
            "page_info": {
                "has_next_page": end < len(lines),
                "end_cursor": str(end) if window else "",
            },
            "total_count": len(lines),
        }

    @staticmethod
    def resolve_stock_movements(
        _root: object,
        info: GraphQLResolveInfo,
        product_id: str,
        first: int | None = None,
        after: str | None = None,
    ) -> dict[str, Any]:
        try:
            context = context_from_info(info)
            product = product_for_context(context, _uuid_or_not_found(product_id))
            page = stock_movements_for_product(
                context,
                product=product,
                after=after,
                first=first,
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return {
            "nodes": page.items,
            "page_info": _page_info(page),
            "total_count": page.total_count,
        }

    @staticmethod
    def resolve_product_orders(
        _root: object,
        info: GraphQLResolveInfo,
        product_id: str,
        first: int | None = None,
        after: str | None = None,
    ) -> dict[str, Any]:
        try:
            context = context_from_info(info)
            product = product_for_context(context, _uuid_or_not_found(product_id))
            from apps.sales.models import OrderItem

            page = paginate(
                OrderItem.objects.filter(
                    order__organisation=context.organisation,
                    order__inventory=context.inventory,
                    product_id=product.pk,
                ).select_related("order", "order__buyer"),
                cursor_field="created_at",
                after=after,
                first=first,
                descending=True,
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return {
            "nodes": page.items,
            "page_info": _page_info(page),
            "total_count": page.total_count,
            "available_from_stage": "sales",
        }

    @staticmethod
    def resolve_product_shipments(
        _root: object,
        info: GraphQLResolveInfo,
        product_id: str,
        first: int | None = None,
        after: str | None = None,
    ) -> dict[str, Any]:
        del first, after
        try:
            context = context_from_info(info)
            product_for_context(context, _uuid_or_not_found(product_id))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return {
            "nodes": [],
            "page_info": {"has_next_page": False, "end_cursor": ""},
            "total_count": 0,
            "available_from_stage": "shipping",
        }

    @staticmethod
    def resolve_inventory_alerts(
        _root: object,
        info: GraphQLResolveInfo,
        limit: int = 20,
    ) -> list[InventoryAlert]:
        try:
            return active_stock_alerts(context_from_info(info), limit=limit)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_inventory_import(
        _root: object,
        info: GraphQLResolveInfo,
        id: str,
    ) -> InventoryImport:
        try:
            return inventory_import_for_context(
                context_from_info(info),
                _uuid_or_not_found(id),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_inventory_imports(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> list[InventoryImport]:
        try:
            return inventory_imports_for_context(context_from_info(info))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_inventory_export(
        _root: object,
        info: GraphQLResolveInfo,
        id: str,
    ) -> InventoryExport:
        try:
            return inventory_export_for_context(
                context_from_info(info),
                _uuid_or_not_found(id),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_inventory_exports(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> list[InventoryExport]:
        try:
            return inventory_exports_for_context(context_from_info(info))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_inventory_import_template(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> dict[str, Any]:
        try:
            context = context_from_info(info)
            file_name, content_type, content = build_import_template(context)
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return {
            "file_name": file_name,
            "content_type": content_type,
            "content_base64": base64.b64encode(content).decode("ascii"),
            "columns": [
                {
                    "destination": column.destination,
                    "header": column.header,
                    "required": column.required,
                }
                for column in import_template_columns(context)
            ],
        }


class InventoryMutation(graphene.ObjectType):  # type: ignore[misc]
    create_custom_field = CreateCustomField.Field(required=True)
    update_custom_field = UpdateCustomField.Field(required=True)
    reorder_custom_fields = ReorderCustomFields.Field(required=True)
    create_product = CreateProduct.Field(required=True)
    update_product = UpdateProduct.Field(required=True)
    record_stock_movement = RecordStockMovement.Field(required=True)
    archive_product = ArchiveProduct.Field(required=True)
    restore_product = RestoreProduct.Field(required=True)
    attach_product_media = AttachProductMedia.Field(required=True)
    set_primary_product_media = SetPrimaryProductMedia.Field(required=True)
    remove_product_media = RemoveProductMedia.Field(required=True)
    start_inventory_import = StartInventoryImport.Field(required=True)
    preview_inventory_import = PreviewInventoryImport.Field(required=True)
    confirm_inventory_import = ConfirmInventoryImport.Field(required=True)
    retry_inventory_import = RetryInventoryImport.Field(required=True)
    start_inventory_export = StartInventoryExport.Field(required=True)
    retry_inventory_export = RetryInventoryExport.Field(required=True)
    update_inventory_low_stock_threshold = UpdateInventoryLowStockThreshold.Field(required=True)
    update_product_low_stock_threshold = UpdateProductLowStockThreshold.Field(required=True)
