"""Catalogue persistence for the tenant inventory.

Stock quantities are not stored here. The ledger and its balance arrive with
T1.2 so that a saldo can never be written without an immutable movement.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

CURRENCY_CLP = "CLP"


class Inventory(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        related_name="inventories",
    )
    name = models.CharField(max_length=160, default="Inventario principal")
    is_active = models.BooleanField(default=True)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("organisation", "name"),
                name="inventory_unique_name_per_org",
            )
        ]

    def __str__(self) -> str:
        return f"{self.organisation} · {self.name}"


class CustomFieldDefinition(models.Model):
    """One dynamic column of an inventory.

    The key is stable and never changes; the label is only a presentation
    concern. Deactivating keeps historical values and frees one active slot.
    """

    MAX_ACTIVE_PER_INVENTORY = 15

    class FieldType(models.TextChoices):
        SHORT_TEXT = "short_text", "Texto corto"
        DECIMAL = "decimal", "Número decimal"
        DATE = "date", "Fecha"
        BOOLEAN = "boolean", "Booleano"
        SINGLE_SELECT = "single_select", "Selección única"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.CASCADE,
        related_name="custom_fields",
    )
    key = models.CharField(max_length=60)
    label = models.CharField(max_length=80)
    field_type = models.CharField(max_length=20, choices=FieldType.choices)
    options = models.JSONField(default=list, blank=True)
    help_text = models.CharField(max_length=160, blank=True)
    is_required = models.BooleanField(default=False)
    is_visible = models.BooleanField(default=True)
    is_filterable = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("position", "created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("inventory", "key"),
                name="custom_field_unique_key_per_inventory",
            ),
            models.UniqueConstraint(
                "inventory",
                Lower("label"),
                name="custom_field_unique_label_per_inventory",
            ),
        ]
        indexes = [
            models.Index(
                fields=("inventory", "is_active", "position"),
                name="custom_field_active_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.inventory} · {self.key}"

    @property
    def option_keys(self) -> list[str]:
        keys: list[str] = []
        for option in self.options or []:
            if isinstance(option, dict) and isinstance(option.get("key"), str):
                keys.append(option["key"])
        return keys


class Product(models.Model):
    """A catalogue entry. It never carries a single lifecycle status.

    Availability, reservations and fulfilment are projected from the ledger and
    from sales, so the same product shows several counts at once.
    """

    class CatalogStatus(models.TextChoices):
        ACTIVE = "active", "Activo"
        INACTIVE = "inactive", "Inactivo"
        ARCHIVED = "archived", "Archivado"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.PROTECT,
        related_name="products",
    )
    name = models.CharField(max_length=160)
    catalog_status = models.CharField(
        max_length=12,
        choices=CatalogStatus.choices,
        default=CatalogStatus.ACTIVE,
    )
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        null=True,
        blank=True,
    )
    sale_price = models.DecimalField(
        max_digits=12,
        decimal_places=0,
        null=True,
        blank=True,
    )
    currency = models.CharField(max_length=3, default=CURRENCY_CLP, editable=False)
    extra_attributes = models.JSONField(default=dict, blank=True)
    low_stock_threshold = models.PositiveIntegerField(null=True, blank=True)
    primary_image = models.ForeignKey(
        "media_assets.MediaAsset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="primary_for_products",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_products",
    )
    archived_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name", "created_at")
        constraints = [
            models.UniqueConstraint(
                "inventory",
                Lower("name"),
                condition=~models.Q(catalog_status="archived"),
                name="product_unique_active_name_per_inventory",
            ),
            models.CheckConstraint(
                condition=models.Q(purchase_price__isnull=True) | models.Q(purchase_price__gte=0),
                name="product_purchase_price_not_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(sale_price__isnull=True) | models.Q(sale_price__gte=0),
                name="product_sale_price_not_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(currency=CURRENCY_CLP),
                name="product_currency_is_clp",
            ),
            models.CheckConstraint(
                condition=models.Q(catalog_status="archived", archived_at__isnull=False)
                | ~models.Q(catalog_status="archived"),
                name="product_archived_requires_timestamp",
            ),
        ]
        indexes = [
            models.Index(
                fields=("inventory", "catalog_status", "name"),
                name="product_catalog_idx",
            )
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def is_archived(self) -> bool:
        return self.catalog_status == self.CatalogStatus.ARCHIVED


class ProductMediaAttachment(models.Model):
    """A private image attached to one product.

    `Product.primary_image` is the presentation shortcut; this relation is the
    complete gallery and keeps the underlying MediaAsset tenant-private.
    """

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="media_attachments",
    )
    asset = models.OneToOneField(
        "media_assets.MediaAsset",
        on_delete=models.PROTECT,
        related_name="product_attachment",
    )
    attached_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("position", "created_at")
        indexes = [
            models.Index(
                fields=("product", "position"),
                name="product_media_position_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.product} · {self.asset.original_name}"


class StockBalance(models.Model):
    """The projected saldo of one product.

    It is only written inside the same transaction that appends a movement or
    that changes an active reservation, never from a client-supplied number.
    """

    product = models.OneToOneField(
        Product,
        on_delete=models.PROTECT,
        related_name="balance",
        primary_key=True,
    )
    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.PROTECT,
        related_name="balances",
    )
    on_hand = models.IntegerField(default=0)
    reserved = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(on_hand__gte=0),
                name="stock_balance_on_hand_not_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(reserved__gte=0),
                name="stock_balance_reserved_not_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(reserved__lte=models.F("on_hand")),
                name="stock_balance_available_not_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product} · {self.available}"

    @property
    def available(self) -> int:
        return max(self.on_hand - self.reserved, 0)


class StockMovement(models.Model):
    """An immutable ledger entry. The saldo is derived, never overwritten."""

    class MovementType(models.TextChoices):
        ENTRY = "entry", "Entrada"
        EXIT = "exit", "Salida"
        SHRINKAGE = "shrinkage", "Merma"
        CORRECTION = "correction", "Corrección"

    POSITIVE_TYPES = frozenset({MovementType.ENTRY})
    NEGATIVE_TYPES = frozenset({MovementType.EXIT, MovementType.SHRINKAGE})

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="stock_movements",
    )
    movement_type = models.CharField(max_length=12, choices=MovementType.choices)
    quantity = models.IntegerField()
    balance_after = models.IntegerField()
    reason = models.CharField(max_length=120, blank=True)
    note = models.CharField(max_length=280, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    reference_type = models.CharField(max_length=40, blank=True)
    reference_public_id = models.CharField(max_length=80, blank=True)
    corrects = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="corrections",
    )
    correlation_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(quantity=0),
                name="stock_movement_quantity_not_zero",
            ),
            models.CheckConstraint(
                condition=models.Q(balance_after__gte=0),
                name="stock_movement_balance_not_negative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(movement_type="entry", quantity__gt=0)
                    | models.Q(movement_type__in=("exit", "shrinkage"), quantity__lt=0)
                    | models.Q(movement_type="correction")
                ),
                name="stock_movement_sign_matches_type",
            ),
        ]
        indexes = [
            models.Index(
                fields=("product", "-created_at"),
                name="stock_movement_product_idx",
            ),
            models.Index(
                fields=("inventory", "-created_at"),
                name="stock_movement_ledger_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.product} · {self.movement_type} · {self.quantity:+d}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None:
            raise ValidationError("Los movimientos de stock son inmutables.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise ValidationError("Los movimientos de stock son inmutables.")


class InventoryAlert(models.Model):
    class AlertType(models.TextChoices):
        LOW_STOCK = "low_stock", "Stock bajo"
        OUT_OF_STOCK = "out_of_stock", "Sin stock"

    class Status(models.TextChoices):
        ACTIVE = "active", "Activa"
        RESOLVED = "resolved", "Resuelta"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.PROTECT,
        related_name="alerts",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="stock_alerts",
    )
    alert_type = models.CharField(max_length=20, choices=AlertType.choices)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    threshold = models.PositiveIntegerField()
    available_quantity = models.PositiveIntegerField()
    opened_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-opened_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("product", "alert_type"),
                condition=models.Q(status="active"),
                name="inventory_alert_one_active_type",
            )
        ]
        indexes = [
            models.Index(
                fields=("inventory", "status", "-opened_at"),
                name="inventory_alert_feed_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.product} · {self.alert_type} · {self.status}"


class InventoryImport(models.Model):
    class Status(models.TextChoices):
        ANALYSING = "analysing", "Analizando"
        AWAITING_MAPPING = "awaiting_mapping", "Esperando mapeo"
        QUEUED = "queued", "En cola"
        PROCESSING = "processing", "Procesando"
        SUCCEEDED = "succeeded", "Completada"
        COMPLETED_WITH_ERRORS = "completed_with_errors", "Completada con errores"
        FAILED = "failed", "Fallida"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        related_name="inventory_imports",
    )
    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.PROTECT,
        related_name="imports",
    )
    source_asset = models.ForeignKey(
        "media_assets.MediaAsset",
        on_delete=models.PROTECT,
        related_name="inventory_import_sources",
    )
    report_asset = models.ForeignKey(
        "media_assets.MediaAsset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_import_reports",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="inventory_imports",
    )
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.ANALYSING,
    )
    progress = models.PositiveSmallIntegerField(default=0)
    headers = models.JSONField(default=list, blank=True)
    preview_rows = models.JSONField(default=list, blank=True)
    mapping = models.JSONField(default=dict, blank=True)
    row_errors = models.JSONField(default=list, blank=True)
    total_rows = models.PositiveIntegerField(default=0)
    processed_rows = models.PositiveIntegerField(default=0)
    created_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    error_code = models.CharField(max_length=64, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("inventory", "source_asset"),
                name="inventory_import_unique_source",
            )
        ]
        indexes = [
            models.Index(
                fields=("inventory", "status", "-created_at"),
                name="inventory_import_status_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.source_asset.original_name} · {self.status}"


class InventoryExport(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "En cola"
        PROCESSING = "processing", "Procesando"
        SUCCEEDED = "succeeded", "Completada"
        FAILED = "failed", "Fallida"

    class FileFormat(models.TextChoices):
        CSV = "csv", "CSV"
        XLSX = "xlsx", "XLSX"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        related_name="inventory_exports",
    )
    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.PROTECT,
        related_name="exports",
    )
    file_asset = models.ForeignKey(
        "media_assets.MediaAsset",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_exports",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="inventory_exports",
    )
    file_format = models.CharField(max_length=8, choices=FileFormat.choices)
    filters = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED)
    progress = models.PositiveSmallIntegerField(default=0)
    row_count = models.PositiveIntegerField(default=0)
    error_code = models.CharField(max_length=64, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(
                fields=("inventory", "status", "-created_at"),
                name="inventory_export_status_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.inventory} · {self.file_format} · {self.status}"
