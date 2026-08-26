"""Sales, payment and reconciliation administration."""

from django.contrib import admin
from django.http import HttpRequest

from apps.sales.models import (
    BuyerSnapshot,
    Order,
    OrderEvent,
    OrderItem,
    Payment,
    PaymentOAuthState,
    PaymentProof,
    PaymentWebhookEvent,
    ReconciliationIssue,
    SellerPaymentConnection,
    StockReservation,
)
from tenda.admin import MaintainerModelAdmin


class OrderItemInline(admin.TabularInline):  # type: ignore[type-arg]
    model = OrderItem
    extra = 0
    autocomplete_fields = ("product",)


class BuyerSnapshotInline(admin.StackedInline):  # type: ignore[type-arg]
    model = BuyerSnapshot
    extra = 0


@admin.register(SellerPaymentConnection)
class SellerPaymentConnectionAdmin(MaintainerModelAdmin):
    list_display = (
        "organisation",
        "provider",
        "status",
        "connected_at",
        "disconnected_at",
        "updated_at",
    )
    list_filter = ("provider", "status")
    search_fields = ("organisation__name", "public_id", "provider_account_id")
    autocomplete_fields = ("organisation",)


@admin.register(PaymentOAuthState)
class PaymentOAuthStateAdmin(MaintainerModelAdmin):
    append_only = True
    list_display = (
        "public_id",
        "organisation",
        "provider",
        "expires_at",
        "consumed_at",
        "created_at",
    )
    list_filter = ("provider",)
    search_fields = ("public_id", "organisation__name")
    autocomplete_fields = ("organisation", "initiated_by")


@admin.register(PaymentWebhookEvent)
class PaymentWebhookEventAdmin(MaintainerModelAdmin):
    list_display = (
        "provider",
        "event_type",
        "provider_event_id",
        "status",
        "signature_valid",
        "received_at",
    )
    list_filter = ("provider", "status", "signature_valid", "event_type")
    search_fields = ("public_id", "provider_event_id")
    autocomplete_fields = ("organisation", "order", "payment")


@admin.register(Order)
class OrderAdmin(MaintainerModelAdmin):
    forbid_delete = True
    list_display = (
        "number",
        "organisation",
        "status",
        "payment_method",
        "total_amount",
        "reservation_expires_at",
        "paid_at",
        "created_at",
    )
    list_filter = ("status", "payment_method", "delivery_mode", "reconciliation_status")
    search_fields = ("number", "public_id", "organisation__name")
    autocomplete_fields = ("organisation", "inventory", "created_by")
    inlines = (OrderItemInline, BuyerSnapshotInline)
    snapshot_fields = (
        "organisation",
        "inventory",
        "number",
        "delivery_mode",
        "payment_method",
        "currency",
        "total_amount",
    )

    def get_readonly_fields(
        self,
        request: HttpRequest,
        obj: Order | None = None,
    ) -> tuple[str, ...]:
        fields = list(super().get_readonly_fields(request, obj))
        if obj is not None:
            for name in self.snapshot_fields:
                if name not in fields:
                    fields.append(name)
        return tuple(fields)


@admin.register(OrderItem)
class OrderItemAdmin(MaintainerModelAdmin):
    append_only = True
    list_display = (
        "order",
        "line_number",
        "product_name",
        "quantity",
        "unit_sale_price",
        "unit_cost_snapshot",
    )
    search_fields = ("order__number", "product_name", "product__public_id")
    autocomplete_fields = ("order", "product")


@admin.register(BuyerSnapshot)
class BuyerSnapshotAdmin(MaintainerModelAdmin):
    list_display = ("order", "name", "email", "phone", "completed_at")
    search_fields = ("order__number", "name", "email", "phone")
    autocomplete_fields = ("order",)


@admin.register(StockReservation)
class StockReservationAdmin(MaintainerModelAdmin):
    list_display = (
        "order",
        "product",
        "quantity",
        "expires_at",
        "consumed_at",
        "released_at",
    )
    list_filter = ("consumed_at", "released_at")
    search_fields = ("order__number", "product__name", "public_id")
    autocomplete_fields = ("order", "order_item", "inventory", "product")


@admin.register(Payment)
class PaymentAdmin(MaintainerModelAdmin):
    list_display = (
        "order",
        "method",
        "status",
        "amount",
        "refunded_amount",
        "provider",
        "provider_payment_id",
        "paid_at",
    )
    list_filter = ("method", "status", "provider")
    search_fields = ("order__number", "public_id", "provider_payment_id")
    autocomplete_fields = ("order", "organisation")


@admin.register(PaymentProof)
class PaymentProofAdmin(MaintainerModelAdmin):
    list_display = ("payment", "status", "uploaded_at", "reviewed_at")
    list_filter = ("status",)
    search_fields = ("payment__order__number", "public_id", "asset__public_id")
    autocomplete_fields = ("payment", "asset", "reviewed_by")


@admin.register(OrderEvent)
class OrderEventAdmin(MaintainerModelAdmin):
    append_only = True
    list_display = ("order", "event_type", "from_status", "to_status", "created_at")
    list_filter = ("event_type", "to_status")
    search_fields = ("order__number", "public_id", "correlation_id")
    autocomplete_fields = ("order", "actor")


@admin.register(ReconciliationIssue)
class ReconciliationIssueAdmin(MaintainerModelAdmin):
    list_display = ("kind", "status", "organisation", "order", "created_at")
    list_filter = ("kind", "status")
    search_fields = ("public_id", "order__number", "summary")
    autocomplete_fields = ("organisation", "order", "payment", "webhook_event")
