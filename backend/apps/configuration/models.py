"""Operational values that may change without a deployment."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class OperationalParameter(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="operational_parameters",
    )
    key = models.CharField(max_length=120)
    value = models.JSONField()
    description = models.CharField(max_length=240, blank=True)
    sensitive = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("key",)
        constraints = [
            models.UniqueConstraint(
                fields=("key",),
                condition=Q(organisation__isnull=True),
                name="configuration_global_parameter_unique",
            ),
            models.UniqueConstraint(
                fields=("organisation", "key"),
                condition=Q(organisation__isnull=False),
                name="configuration_tenant_parameter_unique",
            ),
        ]

    def __str__(self) -> str:
        return self.key


class FeatureFlag(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="feature_flags",
    )
    key = models.CharField(max_length=120)
    enabled = models.BooleanField(default=False)
    description = models.CharField(max_length=240, blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("key",)
        constraints = [
            models.UniqueConstraint(
                fields=("key",),
                condition=Q(organisation__isnull=True),
                name="configuration_global_flag_unique",
            ),
            models.UniqueConstraint(
                fields=("organisation", "key"),
                condition=Q(organisation__isnull=False),
                name="configuration_tenant_flag_unique",
            ),
        ]

    def __str__(self) -> str:
        return self.key


class EncryptedCredential(models.Model):
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        related_name="encrypted_credentials",
    )
    provider = models.CharField(max_length=80)
    ciphertext = models.TextField(editable=False)
    key_version = models.PositiveSmallIntegerField(default=1)
    metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("provider", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=("organisation", "provider"),
                condition=Q(is_active=True),
                name="configuration_active_credential_unique",
            )
        ]

    def __str__(self) -> str:
        return f"{self.provider} · {self.organisation}"
