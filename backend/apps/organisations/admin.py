"""Organisation and membership administration."""

from __future__ import annotations

from django.contrib import admin

from tenda.admin import MaintainerModelAdmin

from .models import Membership, Organisation


class MembershipInline(admin.TabularInline):  # type: ignore[type-arg]
    model = Membership
    extra = 0
    fields = (
        "public_id",
        "user",
        "role",
        "view_financials",
        "manage_members",
        "manage_sensitive_configuration",
        "is_active",
    )
    readonly_fields = ("public_id",)
    autocomplete_fields = ("user",)


@admin.register(Organisation)
class OrganisationAdmin(MaintainerModelAdmin):
    list_display = ("name", "public_id", "timezone", "is_active", "created_at")
    list_filter = ("is_active", "timezone")
    search_fields = ("name", "public_id", "business_email", "address")
    inlines = (MembershipInline,)


@admin.register(Membership)
class MembershipAdmin(MaintainerModelAdmin):
    list_display = ("user", "organisation", "role", "is_active", "created_at")
    list_filter = ("role", "is_active", "view_financials")
    search_fields = ("public_id", "user__email", "organisation__name")
    autocomplete_fields = ("user", "organisation")
