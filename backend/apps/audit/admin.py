"""Audit and idempotency administration."""

from django.contrib import admin

from apps.audit.models import AuditEvent, IdempotencyKey
from tenda.admin import MaintainerModelAdmin


@admin.register(AuditEvent)
class AuditEventAdmin(MaintainerModelAdmin):
    append_only = True
    list_display = ("action", "outcome", "organisation", "actor", "created_at")
    list_filter = ("outcome", "action", "created_at")
    search_fields = (
        "action",
        "correlation_id",
        "object_public_id",
        "organisation__name",
    )
    autocomplete_fields = ("organisation", "actor")


@admin.register(IdempotencyKey)
class IdempotencyKeyAdmin(MaintainerModelAdmin):
    list_display = (
        "scope",
        "key",
        "organisation",
        "status",
        "created_at",
    )
    list_filter = ("status", "scope")
    search_fields = ("key", "request_hash", "organisation__name")
    autocomplete_fields = ("organisation", "actor")
