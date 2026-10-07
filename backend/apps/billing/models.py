"""Organisation SaaS plans and Mercado Pago subscription state."""

from __future__ import annotations

import uuid

from django.db import models


class Plan(models.Model):
    class Code(models.TextChoices):
        FREE = "free", "Gratis"
        STARTER = "starter", "Starter"
        GROWTH = "growth", "Growth"
        PRO = "pro", "Pro"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    code = models.CharField(max_length=32, unique=True, choices=Code.choices)
    name = models.CharField(max_length=80)
    price_clp = models.PositiveIntegerField(default=0)
    product_limit = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Null means unlimited non-archived products.",
    )
    ai_assisted_enabled = models.BooleanField(default=False)
    mp_preapproval_plan_id = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("position", "price_clp")

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class OrganisationSubscription(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        PAST_DUE = "past_due", "Past due"
        PAUSED = "paused", "Paused"
        CANCELED = "canceled", "Canceled"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.OneToOneField(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        related_name="subscription",
    )
    plan = models.ForeignKey(
        Plan,
        on_delete=models.PROTECT,
        related_name="subscriptions",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    mp_preapproval_id = models.CharField(max_length=120, blank=True, db_index=True)
    init_point = models.URLField(max_length=500, blank=True)
    payer_email = models.EmailField(blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    past_due_since = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)

    def __str__(self) -> str:
        return f"{self.organisation} · {self.plan.code} · {self.status}"


class BillingWebhookEvent(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "received", "Received"
        PROCESSING = "processing", "Processing"
        PROCESSED = "processed", "Processed"
        IGNORED = "ignored", "Ignored"
        FAILED = "failed", "Failed"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    provider = models.CharField(max_length=40, default="mercado_pago")
    provider_event_id = models.CharField(max_length=160)
    event_type = models.CharField(max_length=120)
    raw_body = models.TextField()
    safe_headers = models.JSONField(default=dict)
    normalized_payload = models.JSONField(default=dict)
    signature_valid = models.BooleanField(default=False)
    provider_resource_id = models.CharField(max_length=160, blank=True)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.RECEIVED,
    )
    attempts = models.PositiveSmallIntegerField(default=0)
    last_error = models.CharField(max_length=240, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("provider", "provider_event_id"),
                name="billing_webhook_unique_event",
            )
        ]

    def __str__(self) -> str:
        return f"{self.event_type} · {self.provider_event_id}"
