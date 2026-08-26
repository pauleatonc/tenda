"""Operational configuration administration."""

from typing import Any

from django.contrib import admin
from django.http import HttpRequest

from apps.configuration.models import (
    EncryptedCredential,
    FeatureFlag,
    OperationalParameter,
)
from apps.users.models import User
from tenda.admin import MaintainerModelAdmin


@admin.register(EncryptedCredential)
class EncryptedCredentialAdmin(MaintainerModelAdmin):
    list_display = ("provider", "organisation", "key_version", "is_active", "updated_at")
    list_filter = ("provider", "is_active", "key_version")
    search_fields = ("organisation__name", "provider", "public_id")
    autocomplete_fields = ("organisation",)


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
