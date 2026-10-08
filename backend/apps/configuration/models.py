"""Operational values that may change without a deployment."""

from __future__ import annotations

import re
import uuid
from typing import Any

from django.conf import settings
from django.db import models
from django.db.models import Q

_SCRIPT_RE = re.compile(r"(?is)<script[^>]*>.*?</script>")
_STYLE_RE = re.compile(r"(?is)<style[^>]*>.*?</style>")
_EVENT_HANDLER_RE = re.compile(r"""\son\w+\s*=\s*(['"]).*?\1""", re.IGNORECASE | re.DOTALL)
_JS_URI_RE = re.compile(r"(?i)javascript:")


def sanitize_terms_html(value: str) -> str:
    """Strip the most dangerous markup from admin-authored HTML."""

    cleaned = _SCRIPT_RE.sub("", value or "")
    cleaned = _STYLE_RE.sub("", cleaned)
    cleaned = _EVENT_HANDLER_RE.sub("", cleaned)
    return _JS_URI_RE.sub("", cleaned)


class TermsAndConditions(models.Model):
    """Singleton site terms, authored as HTML in Django Admin."""

    title = models.CharField(max_length=200, default="Términos y condiciones")
    body_html = models.TextField(
        help_text="HTML del documento. Se muestra tal cual en la web (sin scripts).",
    )
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
        verbose_name = "Términos y condiciones"
        verbose_name_plural = "Términos y condiciones"

    def __str__(self) -> str:
        return self.title

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.pk = 1
        self.body_html = sanitize_terms_html(self.body_html)
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        del args, kwargs
        return 0, {}

    @classmethod
    def get_solo(cls) -> TermsAndConditions | None:
        return cls.objects.filter(pk=1).first()


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
