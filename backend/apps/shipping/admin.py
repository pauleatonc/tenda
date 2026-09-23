"""Shipment and internal label administration."""

from django.contrib import admin
from django.http import HttpRequest

from apps.shipping.models import LabelDocument, Shipment
from tenda.admin import MaintainerModelAdmin


@admin.register(Shipment)
class ShipmentAdmin(MaintainerModelAdmin):
    forbid_delete = True
    list_display = ("number", "status", "order", "organisation", "created_at")
    list_filter = ("status", "delivery_mode")
    search_fields = ("number", "order__number", "tracking_code", "carrier", "public_id")
    autocomplete_fields = ("organisation", "inventory", "order")
    snapshot_fields = (
        "organisation",
        "inventory",
        "order",
        "number",
        "delivery_mode",
        "recipient_name",
        "recipient_tax_id",
        "address_line",
        "commune",
        "region",
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


@admin.register(LabelDocument)
class LabelDocumentAdmin(MaintainerModelAdmin):
    list_display = ("shipment", "expires_at", "created_at")
    search_fields = ("shipment__number",)
    autocomplete_fields = ("organisation", "inventory", "shipment", "asset")
