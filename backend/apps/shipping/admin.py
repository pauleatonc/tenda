"""Shipment, ticket and return administration."""

from django.contrib import admin
from django.http import HttpRequest

from apps.shipping.models import (
    DeliveryConfirmation,
    FollowUpSchedule,
    LabelDocument,
    ReturnCase,
    Shipment,
    ShipmentEvent,
    Ticket,
    TicketMessage,
)
from tenda.admin import MaintainerModelAdmin


class ShipmentEventInline(admin.TabularInline):  # type: ignore[type-arg]
    model = ShipmentEvent
    extra = 0
    autocomplete_fields = ("actor",)


class TicketMessageInline(admin.TabularInline):  # type: ignore[type-arg]
    model = TicketMessage
    extra = 0


@admin.register(Shipment)
class ShipmentAdmin(MaintainerModelAdmin):
    forbid_delete = True
    list_display = ("number", "status", "order", "organisation", "created_at")
    list_filter = ("status",)
    search_fields = ("number", "order__number", "tracking_code", "public_id")
    autocomplete_fields = ("organisation", "inventory", "order")
    inlines = (ShipmentEventInline,)
    snapshot_fields = (
        "organisation",
        "inventory",
        "order",
        "number",
        "delivery_mode",
        "recipient_name",
        "address_line",
        "municipality",
        "city",
        "delivery_notes",
    )

    def get_readonly_fields(
        self,
        request: HttpRequest,
        obj: Shipment | None = None,
    ) -> tuple[str, ...]:
        fields = list(super().get_readonly_fields(request, obj))
        if obj is not None:
            for name in self.snapshot_fields:
                if name not in fields:
                    fields.append(name)
        return tuple(fields)


@admin.register(ShipmentEvent)
class ShipmentEventAdmin(MaintainerModelAdmin):
    append_only = True
    list_display = ("shipment", "event_type", "from_status", "to_status", "created_at")
    list_filter = ("event_type", "is_public")
    search_fields = ("shipment__number", "event_type", "public_id")
    autocomplete_fields = ("shipment", "actor")


@admin.register(DeliveryConfirmation)
class DeliveryConfirmationAdmin(MaintainerModelAdmin):
    list_display = ("shipment", "outcome", "created_at")
    search_fields = ("shipment__number", "public_id")
    autocomplete_fields = ("shipment",)


@admin.register(FollowUpSchedule)
class FollowUpScheduleAdmin(MaintainerModelAdmin):
    list_display = ("shipment", "kind", "status", "due_at")
    search_fields = ("shipment__number", "public_id")
    autocomplete_fields = ("organisation", "shipment", "ticket")


@admin.register(LabelDocument)
class LabelDocumentAdmin(MaintainerModelAdmin):
    list_display = ("shipment", "expires_at", "created_at")
    search_fields = ("shipment__number",)
    autocomplete_fields = ("organisation", "inventory", "shipment", "asset")


@admin.register(Ticket)
class TicketAdmin(MaintainerModelAdmin):
    forbid_delete = True
    list_display = (
        "number",
        "status",
        "category",
        "shipment",
        "organisation",
        "created_at",
    )
    list_filter = ("status", "category")
    search_fields = ("number", "shipment__number", "contact_email")
    autocomplete_fields = ("organisation", "inventory", "shipment")
    inlines = (TicketMessageInline,)
    snapshot_fields = ("organisation", "inventory", "shipment", "number")

    def get_readonly_fields(
        self,
        request: HttpRequest,
        obj: Ticket | None = None,
    ) -> tuple[str, ...]:
        fields = list(super().get_readonly_fields(request, obj))
        if obj is not None:
            for name in self.snapshot_fields:
                if name not in fields:
                    fields.append(name)
        return tuple(fields)


@admin.register(TicketMessage)
class TicketMessageAdmin(MaintainerModelAdmin):
    append_only = True
    list_display = ("ticket", "author_kind", "created_at")
    list_filter = ("author_kind",)
    search_fields = ("ticket__number", "body")
    autocomplete_fields = ("ticket", "actor")


@admin.register(ReturnCase)
class ReturnCaseAdmin(MaintainerModelAdmin):
    forbid_delete = True
    list_display = ("shipment", "kind", "stock_confirmed_at", "created_at")
    list_filter = ("kind",)
    search_fields = ("shipment__number", "public_id")
    autocomplete_fields = ("organisation", "inventory", "shipment", "actor", "stock_confirmed_by")
