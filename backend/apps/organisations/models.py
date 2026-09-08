"""Organisation and membership tenancy models."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class Organisation(models.Model):
    """A seller tenant. Its database id is never part of a public contract."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    name = models.CharField(max_length=160)
    timezone = models.CharField(max_length=64, default="America/Santiago")
    phone = models.CharField(max_length=32, blank=True)
    business_email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    logo_asset_id = models.UUIDField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        permissions = [
            ("view_financials", "Can view financial information"),
            ("manage_sensitive_configuration", "Can manage sensitive configuration"),
        ]

    def __str__(self) -> str:
        return self.name


class Membership(models.Model):
    """A user's role and explicit sensitive grants in one organisation."""

    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        OPERATOR = "operator", "Operator"
        SUPPORT_ADMIN = "support_admin", "Support admin"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        Organisation,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.OPERATOR)
    view_financials = models.BooleanField(default=False)
    manage_members = models.BooleanField(default=False)
    manage_sensitive_configuration = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("organisation", "user"),
                name="organisations_membership_unique_user",
            )
        ]
        indexes = [
            models.Index(
                fields=("organisation", "is_active"),
                name="org_member_active_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.user} · {self.organisation} · {self.role}"

    @property
    def can_view_financials(self) -> bool:
        return self.role in {self.Role.OWNER, self.Role.SUPPORT_ADMIN} or self.view_financials

    @property
    def can_manage_members(self) -> bool:
        return self.role in {self.Role.OWNER, self.Role.SUPPORT_ADMIN} or self.manage_members

    @property
    def can_manage_sensitive_configuration(self) -> bool:
        return (
            self.role in {self.Role.OWNER, self.Role.SUPPORT_ADMIN}
            or self.manage_sensitive_configuration
        )

    @property
    def can_manage_inventory_schema(self) -> bool:
        """Shaping the dynamic columns stays with Owner, per V1-INV-06."""

        return self.role in {self.Role.OWNER, self.Role.SUPPORT_ADMIN}
