"""Notification and contact-request administration."""

from django.contrib import admin

from apps.notifications.models import (
    ContactRequest,
    Notification,
    NotificationDelivery,
    OutboxEvent,
)
from tenda.admin import MaintainerModelAdmin


class NotificationDeliveryInline(admin.TabularInline):  # type: ignore[type-arg]
    model = NotificationDelivery
    extra = 0


@admin.register(OutboxEvent)
class OutboxEventAdmin(MaintainerModelAdmin):
    list_display = ("event_type", "status", "attempts", "available_at", "created_at")
    list_filter = ("status", "event_type")
    search_fields = ("public_id", "deduplication_key", "aggregate_public_id")
    autocomplete_fields = ("organisation",)


@admin.register(Notification)
class NotificationAdmin(MaintainerModelAdmin):
    list_display = ("template", "channel", "status", "recipient", "created_at")
    list_filter = ("status", "channel", "template")
    search_fields = ("public_id", "recipient")
    autocomplete_fields = ("organisation", "user", "outbox_event")
    inlines = (NotificationDeliveryInline,)


@admin.register(NotificationDelivery)
class NotificationDeliveryAdmin(MaintainerModelAdmin):
    list_display = ("notification", "provider", "status", "attempted_at")
    list_filter = ("status", "provider")
    search_fields = ("provider_message_id", "notification__public_id")
    autocomplete_fields = ("notification",)


@admin.register(ContactRequest)
class ContactRequestAdmin(MaintainerModelAdmin):
    list_display = ("email", "name", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("email", "name", "message", "public_id")
