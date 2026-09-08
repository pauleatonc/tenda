"""Identity administration for the general maintainer."""

from __future__ import annotations

from typing import Any

from django import forms
from django.contrib import admin
from django.http import HttpRequest
from django.utils import timezone

from tenda.admin import MaintainerModelAdmin

from .models import (
    AuthRateLimitBucket,
    EmailVerificationToken,
    MobileSession,
    OIDCLoginState,
    PasswordResetToken,
    Profile,
    SocialIdentity,
    User,
)


class UserAdminForm(forms.ModelForm):  # type: ignore[type-arg]
    password = forms.CharField(
        label="Contraseña",
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text="Obligatoria al crear. En edición, déjala vacía para no cambiarla.",
    )

    class Meta:
        model = User
        fields = (
            "email",
            "email_verified_at",
            "is_active",
            "is_staff",
            "is_superuser",
            "groups",
            "user_permissions",
            "session_version",
        )

    def clean(self) -> dict[str, Any]:
        cleaned = super().clean() or {}
        if self.instance.pk is None and not cleaned.get("password"):
            self.add_error("password", "La contraseña es obligatoria al crear el usuario.")
        return cleaned

    def save(self, commit: bool = True) -> User:
        user = super().save(commit=False)
        if not isinstance(user, User):
            raise TypeError("UserAdminForm only saves User instances")
        password = self.cleaned_data.get("password")
        if password:
            user.set_password(password)
        elif user.pk is None:
            user.set_unusable_password()
        if commit:
            user.save()
            self.save_m2m()
            Profile.objects.get_or_create(user=user)
        return user


class ProfileInline(admin.StackedInline):  # type: ignore[type-arg]
    model = Profile
    extra = 0
    fields = (
        "public_id",
        "full_name",
        "phone",
        "locale",
        "photo_asset_id",
        "created_at",
        "updated_at",
    )
    readonly_fields = ("public_id", "created_at", "updated_at")


@admin.register(User)
class UserAdmin(MaintainerModelAdmin):
    form = UserAdminForm
    list_display = (
        "email",
        "public_id",
        "is_active",
        "is_email_verified",
        "is_staff",
        "is_superuser",
        "date_joined",
    )
    list_filter = ("is_active", "is_staff", "is_superuser", "email_verified_at")
    search_fields = ("email", "public_id")
    ordering = ("email",)
    filter_horizontal = ("groups", "user_permissions")
    inlines = (ProfileInline,)

    def get_inlines(self, request: HttpRequest, obj: User | None = None) -> list[Any]:
        if obj is None:
            return []
        return list(super().get_inlines(request, obj))

    def save_model(
        self,
        request: HttpRequest,
        obj: User,
        form: Any,
        change: bool,
    ) -> None:
        super().save_model(request, obj, form, change)
        Profile.objects.get_or_create(user=obj)


@admin.register(Profile)
class ProfileAdmin(MaintainerModelAdmin):
    list_display = ("full_name", "user", "phone", "locale", "updated_at")
    search_fields = ("full_name", "phone", "user__email", "public_id")
    autocomplete_fields = ("user",)


class HashedCredentialAdmin(MaintainerModelAdmin):
    append_only = True


@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(HashedCredentialAdmin):
    list_display = ("public_id", "user", "expires_at", "consumed_at", "created_at")
    list_filter = ("consumed_at", "expires_at")
    search_fields = ("public_id", "user__email")
    autocomplete_fields = ("user",)


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(HashedCredentialAdmin):
    list_display = ("public_id", "user", "expires_at", "consumed_at", "created_at")
    list_filter = ("consumed_at", "expires_at")
    search_fields = ("public_id", "user__email")
    autocomplete_fields = ("user",)


@admin.action(description="Revocar sesiones seleccionadas")
def revoke_sessions(
    _modeladmin: admin.ModelAdmin[Any],
    _request: HttpRequest,
    queryset: Any,
) -> None:
    queryset.filter(revoked_at__isnull=True).update(revoked_at=timezone.now())


@admin.register(MobileSession)
class MobileSessionAdmin(MaintainerModelAdmin):
    list_display = (
        "public_id",
        "user",
        "device_name",
        "expires_at",
        "revoked_at",
        "last_seen_at",
    )
    list_filter = ("revoked_at", "expires_at")
    search_fields = ("public_id", "user__email", "device_name")
    autocomplete_fields = ("user", "active_organisation", "active_inventory")
    actions = (revoke_sessions,)


@admin.register(SocialIdentity)
class SocialIdentityAdmin(MaintainerModelAdmin):
    list_display = ("provider", "subject", "user", "last_login_at", "created_at")
    search_fields = ("provider", "subject", "user__email")
    autocomplete_fields = ("user",)


@admin.register(OIDCLoginState)
class OIDCLoginStateAdmin(HashedCredentialAdmin):
    list_display = ("public_id", "provider", "client", "expires_at", "consumed_at")
    list_filter = ("provider", "client")
    search_fields = ("public_id", "provider")


@admin.register(AuthRateLimitBucket)
class AuthRateLimitBucketAdmin(MaintainerModelAdmin):
    list_display = (
        "action",
        "attempts",
        "window_started_at",
        "blocked_until",
        "updated_at",
    )
    list_filter = ("action", "blocked_until")
    search_fields = ("action", "key_digest")
