"""Tenant-owned sales, reservation, payment and reconciliation aggregates."""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class SellerPaymentConnection(models.Model):
    """Tenant-owned provider connection; OAuth tokens are always encrypted."""

    class Provider(models.TextChoices):
        MERCADO_PAGO = "mercado_pago", "Mercado Pago"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        CONNECTED = "connected", "Connected"
        DISCONNECTED = "disconnected", "Disconnected"
        ERROR = "error", "Error"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        related_name="seller_payment_connections",
    )
    provider = models.CharField(
        max_length=40,
        choices=Provider.choices,
        default=Provider.MERCADO_PAGO,
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    provider_account_id = models.CharField(max_length=120, blank=True)
    scopes = models.JSONField(default=list, blank=True)
    access_token_ciphertext = models.TextField(blank=True, editable=False)
    refresh_token_ciphertext = models.TextField(blank=True, editable=False)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    connected_at = models.DateTimeField(null=True, blank=True)
    disconnected_at = models.DateTimeField(null=True, blank=True)
    last_error_code = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("provider",)
        constraints = [
            models.UniqueConstraint(
                fields=("organisation", "provider"),
                name="sales_seller_payment_connection_unique",
            )
        ]

    def __str__(self) -> str:
        return f"{self.provider} · {self.organisation}"


class PaymentOAuthState(models.Model):
    """One-use OAuth state. Only its SHA-256 digest is persisted."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        related_name="+",
    )
    initiated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="+",
    )
    provider = models.CharField(
        max_length=40,
        choices=SellerPaymentConnection.Provider.choices,
        default=SellerPaymentConnection.Provider.MERCADO_PAGO,
    )
    state_hash = models.CharField(max_length=64, unique=True, editable=False)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(
                fields=("provider", "expires_at"),
                name="sales_oauth_state_expiry_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.provider} · {self.public_id}"


class PaymentWebhookEvent(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        PROCESSING = "processing", "Processing"
        PROCESSED = "processed", "Processed"
        IGNORED = "ignored", "Ignored"
        FAILED = "failed", "Failed"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    provider = models.CharField(max_length=40)
    provider_event_id = models.CharField(max_length=160)
    event_type = models.CharField(max_length=120)
    raw_body = models.TextField()
    safe_headers = models.JSONField(default=dict)
    normalized_payload = models.JSONField(default=dict)
    signature_valid = models.BooleanField(default=False)
    provider_resource_id = models.CharField(max_length=160, blank=True)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="payment_webhook_events",
    )
    order = models.ForeignKey(
        "sales.Order",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="webhook_events",
    )
    payment = models.ForeignKey(
        "sales.Payment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="webhook_events",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.RECEIVED,
    )
    attempts = models.PositiveSmallIntegerField(default=0)
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    next_retry_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ("-received_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("provider", "provider_event_id"),
                name="sales_webhook_provider_event_unique",
            )
        ]
        indexes = [
            models.Index(
                fields=("status", "received_at"),
                name="sales_webhook_processing_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.provider}:{self.provider_event_id}"


class Order(models.Model):
    """A historical sale whose commercial snapshots never follow Product edits."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        RESERVED = "reserved", "Reservado"
        PURCHASE_IN_PROGRESS = "purchase_in_progress", "Proceso de compra"
        PURCHASE_VALIDATION = "purchase_validation", "Validación de compra"
        PAID = "paid", "Vendido"
        CANCELLED = "cancelled", "Cancelado"
        EXPIRED = "expired", "Expirado"
        REFUNDED = "refunded", "Reembolsado"

    class DeliveryMode(models.TextChoices):
        SHIPPING = "shipping", "Despacho"
        PICKUP = "pickup", "Retiro"
        COORDINATED = "coordinated", "A coordinar"

    class PaymentMethod(models.TextChoices):
        MERCADO_PAGO = "mercado_pago", "Mercado Pago"
        BANK_TRANSFER = "bank_transfer", "Transferencia"
        CASH = "cash", "Efectivo"

    class ReconciliationStatus(models.TextChoices):
        OK = "ok", "Sin diferencias"
        REQUIRED = "required", "Requiere conciliación"
        RETRYING = "retrying", "Reintentando"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        related_name="orders",
    )
    inventory = models.ForeignKey(
        "inventory.Inventory",
        on_delete=models.PROTECT,
        related_name="orders",
    )
    number = models.CharField(max_length=32)
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    delivery_mode = models.CharField(max_length=16, choices=DeliveryMode.choices)
    payment_method = models.CharField(max_length=24, choices=PaymentMethod.choices)
    currency = models.CharField(max_length=3, default="CLP", editable=False)
    total_amount = models.DecimalField(max_digits=14, decimal_places=0)
    reservation_expires_at = models.DateTimeField()
    expiry_paused_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    expired_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    public_token_hash = models.CharField(max_length=64, unique=True, editable=False)
    public_token_ciphertext = models.TextField(editable=False)
    public_token_expires_at = models.DateTimeField()
    reconciliation_status = models.CharField(
        max_length=16,
        choices=ReconciliationStatus.choices,
        default=ReconciliationStatus.OK,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_orders",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    IMMUTABLE_FIELDS = (
        "organisation_id",
        "inventory_id",
        "number",
        "delivery_mode",
        "payment_method",
        "currency",
        "total_amount",
        "public_token_hash",
        "public_token_ciphertext",
    )

    class Meta:
        ordering = ("-created_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organisation", "number"),
                name="sales_order_tenant_number_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(total_amount__gte=0),
                name="sales_order_total_not_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(currency="CLP"),
                name="sales_order_currency_clp",
            ),
        ]
        indexes = [
            models.Index(
                fields=("organisation", "status", "-created_at"),
                name="sales_order_tenant_status_idx",
            ),
            models.Index(
                fields=("status", "reservation_expires_at"),
                name="sales_order_expiry_idx",
            ),
            models.Index(
                fields=("organisation", "paid_at"),
                name="sales_order_paid_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.number} · {self.status}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None:
            previous = type(self).objects.only(*self.IMMUTABLE_FIELDS).get(pk=self.pk)
            if any(
                getattr(previous, field) != getattr(self, field) for field in self.IMMUTABLE_FIELDS
            ):
                raise ValidationError("Los datos comerciales del pedido son inmutables.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise ValidationError("Los pedidos no se eliminan.")


class OrderItem(models.Model):
    """One immutable effective-price line; a Product may appear repeatedly."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="items")
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    line_number = models.PositiveSmallIntegerField()
    product_name = models.CharField(max_length=160)
    quantity = models.PositiveIntegerField()
    unit_sale_price = models.DecimalField(max_digits=14, decimal_places=0)
    unit_cost_snapshot = models.DecimalField(
        max_digits=14,
        decimal_places=0,
        null=True,
        blank=True,
    )
    currency = models.CharField(max_length=3, default="CLP", editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("line_number", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("order", "line_number"),
                name="sales_order_item_line_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="sales_order_item_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_sale_price__gte=0),
                name="sales_order_item_sale_not_negative",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(unit_cost_snapshot__isnull=True) | models.Q(unit_cost_snapshot__gte=0)
                ),
                name="sales_order_item_cost_not_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(currency="CLP"),
                name="sales_order_item_currency_clp",
            ),
        ]
        indexes = [
            models.Index(
                fields=("product", "order"),
                name="sales_order_item_product_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.order.number} · {self.product_name} · {self.quantity}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None:
            raise ValidationError("Las líneas de pedido son inmutables.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise ValidationError("Las líneas de pedido son inmutables.")

    @property
    def line_total(self) -> int:
        return int(self.unit_sale_price) * self.quantity


class BuyerSnapshot(models.Model):
    order = models.OneToOneField(
        Order,
        on_delete=models.PROTECT,
        related_name="buyer",
        primary_key=True,
    )
    name = models.CharField(max_length=160)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    recipient_name = models.CharField(max_length=160, blank=True)
    recipient_tax_id = models.CharField(max_length=16, blank=True)
    address_line = models.CharField(max_length=240, blank=True)
    commune = models.CharField(max_length=120, blank=True)
    region = models.CharField(max_length=120, blank=True)
    delivery_notes = models.CharField(max_length=500, blank=True)
    tax_id = models.CharField(max_length=32, blank=True)
    tax_name = models.CharField(max_length=180, blank=True)
    tax_activity = models.CharField(max_length=180, blank=True)
    tax_address = models.CharField(max_length=240, blank=True)
    tax_commune = models.CharField(max_length=120, blank=True)
    tax_region = models.CharField(max_length=120, blank=True)
    tax_email = models.EmailField(blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.order.number} · {self.name}"


class StockReservation(models.Model):
    """A durable quantity claim whose terminal timestamps are mutually exclusive."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="reservations")
    order_item = models.OneToOneField(
        OrderItem,
        on_delete=models.PROTECT,
        related_name="reservation",
    )
    inventory = models.ForeignKey(
        "inventory.Inventory",
        on_delete=models.PROTECT,
        related_name="stock_reservations",
    )
    product = models.ForeignKey(
        "inventory.Product",
        on_delete=models.PROTECT,
        related_name="stock_reservations",
    )
    quantity = models.PositiveIntegerField()
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    released_at = models.DateTimeField(null=True, blank=True)
    release_reason = models.CharField(max_length=120, blank=True)
    stock_movement = models.ForeignKey(
        "inventory.StockMovement",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="consumed_reservations",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("expires_at", "id")
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="sales_reservation_quantity_positive",
            ),
            models.CheckConstraint(
                condition=~(
                    models.Q(consumed_at__isnull=False) & models.Q(released_at__isnull=False)
                ),
                name="sales_reservation_single_terminal",
            ),
        ]
        indexes = [
            models.Index(
                fields=("order", "released_at", "consumed_at"),
                name="sales_res_order_state_idx",
            ),
            models.Index(
                fields=("expires_at", "released_at", "consumed_at"),
                name="sales_reservation_expiry_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.order.number} · {self.product} · {self.quantity}"

    @property
    def is_active(self) -> bool:
        return self.consumed_at is None and self.released_at is None


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        VALIDATION = "validation", "En validación"
        APPROVED = "approved", "Aprobado"
        REJECTED = "rejected", "Rechazado"
        CANCELLED = "cancelled", "Cancelado"
        REFUNDED = "refunded", "Reembolsado"
        RECONCILIATION_REQUIRED = "reconciliation_required", "Requiere conciliación"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    order = models.OneToOneField(Order, on_delete=models.PROTECT, related_name="payment")
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        related_name="payments",
    )
    method = models.CharField(max_length=24, choices=Order.PaymentMethod.choices)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING,
    )
    amount = models.DecimalField(max_digits=14, decimal_places=0)
    currency = models.CharField(max_length=3, default="CLP", editable=False)
    provider = models.CharField(max_length=40, blank=True)
    provider_account_id = models.CharField(max_length=120, blank=True)
    provider_preference_id = models.CharField(max_length=160, blank=True)
    checkout_url = models.URLField(max_length=1000, blank=True)
    provider_payment_id = models.CharField(max_length=160, blank=True)
    external_reference = models.CharField(max_length=160, blank=True)
    provider_status = models.CharField(max_length=80, blank=True)
    provider_status_detail = models.CharField(max_length=160, blank=True)
    fee_requested = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    fee_reported = models.DecimalField(
        max_digits=14,
        decimal_places=0,
        null=True,
        blank=True,
    )
    net_received = models.DecimalField(
        max_digits=14,
        decimal_places=0,
        null=True,
        blank=True,
    )
    refunded_amount = models.DecimalField(max_digits=14, decimal_places=0, default=0)
    paid_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    manual_note = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.CheckConstraint(
                condition=models.Q(amount__gte=0),
                name="sales_payment_amount_not_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(refunded_amount__gte=0),
                name="sales_payment_refund_not_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(refunded_amount__lte=models.F("amount")),
                name="sales_payment_refund_within_amount",
            ),
            models.CheckConstraint(
                condition=models.Q(currency="CLP"),
                name="sales_payment_currency_clp",
            ),
            models.UniqueConstraint(
                fields=("provider", "provider_payment_id"),
                condition=~models.Q(provider_payment_id=""),
                name="sales_payment_provider_id_unique",
            ),
        ]
        indexes = [
            models.Index(
                fields=("organisation", "status", "paid_at"),
                name="sales_pay_tenant_status_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.order.number} · {self.method} · {self.status}"


class PaymentProof(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Carga pendiente"
        READY = "ready", "Por revisar"
        APPROVED = "approved", "Aprobado"
        REJECTED = "rejected", "Rechazado"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    payment = models.OneToOneField(
        Payment,
        on_delete=models.PROTECT,
        related_name="proof",
    )
    asset = models.OneToOneField(
        "media_assets.MediaAsset",
        on_delete=models.PROTECT,
        related_name="payment_proof",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    uploaded_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    rejection_reason = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.payment.order.number} · {self.status}"


class OrderEvent(models.Model):
    """Append-only seller/public/system timeline entry."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    order = models.ForeignKey(Order, on_delete=models.PROTECT, related_name="timeline")
    event_type = models.CharField(max_length=80)
    from_status = models.CharField(max_length=24, blank=True)
    to_status = models.CharField(max_length=24, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    title = models.CharField(max_length=160)
    detail = models.CharField(max_length=500, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    correlation_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")
        indexes = [
            models.Index(
                fields=("order", "created_at"),
                name="sales_order_event_timeline_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.order.number} · {self.event_type}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None:
            raise ValidationError("La línea de tiempo es inmutable.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise ValidationError("La línea de tiempo es inmutable.")


class ReconciliationIssue(models.Model):
    class Kind(models.TextChoices):
        UNKNOWN_PAYMENT = "unknown_payment", "Pago sin pedido"
        PAYMENT_MISMATCH = "payment_mismatch", "Datos de pago distintos"
        PAID_WITHOUT_STOCK = "paid_without_stock", "Pago sin salida de stock"
        WEBHOOK_PENDING = "webhook_pending", "Webhook pendiente"
        FEE_MISMATCH = "fee_mismatch", "Comisión distinta"
        PARTIAL_REFUND = "partial_refund", "Reembolso parcial"
        PROVIDER_STATUS = "provider_status", "Estado desconocido"

    class Status(models.TextChoices):
        OPEN = "open", "Abierta"
        RETRYING = "retrying", "Reintentando"
        RESOLVED = "resolved", "Resuelta"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reconciliation_issues",
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reconciliation_issues",
    )
    payment = models.ForeignKey(
        Payment,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reconciliation_issues",
    )
    webhook_event = models.ForeignKey(
        PaymentWebhookEvent,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reconciliation_issues",
    )
    kind = models.CharField(max_length=40, choices=Kind.choices)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.OPEN,
    )
    summary = models.CharField(max_length=240)
    details = models.JSONField(default=dict, blank=True)
    retry_count = models.PositiveSmallIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(
                fields=("organisation", "status", "-created_at"),
                name="sales_reconcile_tenant_idx",
            ),
            models.Index(
                fields=("status", "kind", "-created_at"),
                name="sales_reconcile_queue_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.kind} · {self.status} · {self.public_id}"
