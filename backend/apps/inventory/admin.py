"""Catalogue and stock administration."""

from django.contrib import admin

from tenda.admin import MaintainerModelAdmin

from .models import (
    CustomFieldDefinition,
    Inventory,
    InventoryAlert,
    InventoryExport,
    InventoryImport,
    Product,
    ProductMediaAttachment,
    StockBalance,
    StockMovement,
)


class ProductMediaAttachmentInline(admin.TabularInline):  # type: ignore[type-arg]
    model = ProductMediaAttachment
    extra = 0
    autocomplete_fields = ("asset", "attached_by")


@admin.register(Inventory)
class InventoryAdmin(MaintainerModelAdmin):
    list_display = (
        "name",
        "organisation",
        "public_id",
        "low_stock_threshold",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active",)
    search_fields = ("name", "organisation__name", "public_id")
    autocomplete_fields = ("organisation",)


@admin.register(CustomFieldDefinition)
class CustomFieldDefinitionAdmin(MaintainerModelAdmin):
    list_display = ("label", "key", "field_type", "inventory", "is_active", "position")
    list_filter = ("field_type", "is_active", "is_required")
    search_fields = ("key", "label", "inventory__organisation__name")
    autocomplete_fields = ("inventory",)


@admin.register(Product)
class ProductAdmin(MaintainerModelAdmin):
    list_display = (
        "name",
        "inventory",
        "catalog_status",
        "low_stock_threshold",
        "sale_price",
        "created_at",
    )
    list_filter = ("catalog_status",)
    search_fields = ("name", "public_id", "inventory__organisation__name")
    autocomplete_fields = ("inventory", "primary_image", "created_by")
    inlines = (ProductMediaAttachmentInline,)


@admin.register(StockBalance)
class StockBalanceAdmin(MaintainerModelAdmin):
    list_display = ("product", "inventory", "on_hand", "reserved", "updated_at")
    search_fields = ("product__name", "product__public_id")
    autocomplete_fields = ("product", "inventory")


@admin.register(StockMovement)
class StockMovementAdmin(MaintainerModelAdmin):
    append_only = True
    list_display = (
        "product",
        "movement_type",
        "quantity",
        "balance_after",
        "actor",
        "created_at",
    )
    list_filter = ("movement_type",)
    search_fields = ("product__name", "public_id", "correlation_id")
    autocomplete_fields = ("inventory", "product", "actor", "corrects")


@admin.register(InventoryAlert)
class InventoryAlertAdmin(MaintainerModelAdmin):
    list_display = (
        "product",
        "alert_type",
        "status",
        "available_quantity",
        "threshold",
        "opened_at",
    )
    list_filter = ("alert_type", "status")
    search_fields = ("product__name", "public_id")
    autocomplete_fields = ("inventory", "product")


@admin.register(InventoryImport)
class InventoryImportAdmin(MaintainerModelAdmin):
    list_display = (
        "public_id",
        "inventory",
        "status",
        "progress",
        "created_count",
        "error_count",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("public_id", "source_asset__original_name")
    autocomplete_fields = (
        "organisation",
        "inventory",
        "source_asset",
        "report_asset",
        "created_by",
    )


@admin.register(InventoryExport)
class InventoryExportAdmin(MaintainerModelAdmin):
    list_display = (
        "public_id",
        "inventory",
        "file_format",
        "status",
        "row_count",
        "created_at",
    )
    list_filter = ("file_format", "status")
    search_fields = ("public_id",)
    autocomplete_fields = ("organisation", "inventory", "file_asset", "created_by")


@admin.register(ProductMediaAttachment)
class ProductMediaAttachmentAdmin(MaintainerModelAdmin):
    list_display = ("product", "asset", "position", "attached_by", "created_at")
    search_fields = ("product__name", "asset__public_id")
    autocomplete_fields = ("product", "asset", "attached_by")
