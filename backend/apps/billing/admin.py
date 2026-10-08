from django.contrib import admin

from tenda.admin import MaintainerModelAdmin

from .models import BillingWebhookEvent, OrganisationSubscription, Plan


@admin.register(Plan)
class PlanAdmin(MaintainerModelAdmin):
    list_display = (
        "code",
        "name",
        "price_clp",
        "product_limit",
        "ai_assisted_enabled",
        "is_active",
        "mp_preapproval_plan_id",
    )
    list_filter = ("is_active", "ai_assisted_enabled")
    search_fields = ("code", "name", "mp_preapproval_plan_id")
    ordering = ("position", "price_clp")


@admin.register(OrganisationSubscription)
class OrganisationSubscriptionAdmin(MaintainerModelAdmin):
    list_display = (
        "organisation",
        "plan",
        "status",
        "mp_preapproval_id",
        "cancel_at_period_end",
        "current_period_end",
        "updated_at",
    )
    list_filter = ("status", "plan__code", "cancel_at_period_end")
    search_fields = (
        "organisation__name",
        "mp_preapproval_id",
        "payer_email",
    )
    raw_id_fields = ("organisation", "plan")


@admin.register(BillingWebhookEvent)
class BillingWebhookEventAdmin(MaintainerModelAdmin):
    list_display = (
        "event_type",
        "provider_event_id",
        "status",
        "signature_valid",
        "attempts",
        "created_at",
    )
    list_filter = ("status", "event_type", "signature_valid")
    search_fields = ("provider_event_id", "provider_resource_id")
    readonly_fields = (
        "public_id",
        "raw_body",
        "safe_headers",
        "normalized_payload",
        "created_at",
        "updated_at",
    )
