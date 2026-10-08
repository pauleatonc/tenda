"""Operational configuration administration."""

from typing import Any

from django.contrib import admin
from django.db import models
from django.forms import Textarea
from django.http import HttpRequest

from apps.configuration.models import FeatureFlag, OperationalParameter, TermsAndConditions
from apps.users.models import User
from tenda.admin import MaintainerModelAdmin


@admin.register(TermsAndConditions)
class TermsAndConditionsAdmin(MaintainerModelAdmin):
    list_display = ("title", "updated_at", "updated_by")
    readonly_fields = ("updated_at", "created_at", "updated_by")
    fields = ("title", "body_html", "updated_at", "created_at", "updated_by")
    formfield_overrides = {
        models.TextField: {
            "widget": Textarea(
                attrs={
                    "rows": 28,
                    "cols": 100,
                    "style": "font-family: ui-monospace, monospace",
                }
            )
        },
    }

    def has_add_permission(self, request: HttpRequest) -> bool:
        if TermsAndConditions.objects.exists():
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request: HttpRequest, obj: Any = None) -> bool:
        del request, obj
        return False

    def save_model(
        self,
        request: HttpRequest,
        obj: TermsAndConditions,
        form: Any,
        change: bool,
    ) -> None:
        obj.updated_by = request.user if isinstance(request.user, User) else None
        super().save_model(request, obj, form, change)


@admin.register(OperationalParameter)
class OperationalParameterAdmin(MaintainerModelAdmin):
    list_display = ("key", "organisation", "sensitive", "is_active", "updated_at")
    list_filter = ("sensitive", "is_active")
    search_fields = ("key", "description", "organisation__name")
    autocomplete_fields = ("organisation",)

    def save_model(
        self,
        request: HttpRequest,
        obj: OperationalParameter,
        form: Any,
        change: bool,
    ) -> None:
        obj.updated_by = request.user if isinstance(request.user, User) else None
        super().save_model(request, obj, form, change)


@admin.register(FeatureFlag)
class FeatureFlagAdmin(MaintainerModelAdmin):
    list_display = ("key", "organisation", "enabled", "updated_at")
    list_filter = ("enabled",)
    search_fields = ("key", "description", "organisation__name")
    autocomplete_fields = ("organisation",)

    def save_model(
        self,
        request: HttpRequest,
        obj: FeatureFlag,
        form: Any,
        change: bool,
    ) -> None:
        obj.updated_by = request.user if isinstance(request.user, User) else None
        super().save_model(request, obj, form, change)
