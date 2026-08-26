"""Durable communication records."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class OutboxEvent(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        SUCCEEDED = "succeeded", "Succeeded"
        DEAD = "dead", "Dead letter"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="outbox_events",
    )
    event_type = models.CharField(max_length=120)
    aggregate_type = models.CharField(max_length=80, blank=True)
    aggregate_public_id = models.CharField(max_length=80, blank=True)
    deduplication_key = models.CharField(
        max_length=200,
        unique=True,
        null=True,
        blank=True,
    )
    payload = models.JSONField(default=dict)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    attempts = models.PositiveSmallIntegerField(default=0)
    available_at = models.DateTimeField(default=timezone.now)
    locked_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(
                fields=("status", "available_at", "created_at"),
                name="notifications_outbox_ready_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} · {self.status} · {self.public_id}"


class Notification(models.Model):
    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        IN_APP = "in_app", "In app"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )
    outbox_event = models.ForeignKey(
        OutboxEvent,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="notifications",
    )
    channel = models.CharField(max_length=16, choices=Channel.choices)
    template = models.CharField(max_length=80)
    recipient = models.CharField(max_length=254)
    context = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.QUEUED,
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(
                fields=("organisation", "user", "created_at"),
                name="notifications_tenant_user_idx",
            )
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("outbox_event", "channel"),
                name="notifications_outbox_channel_unique",
            )
        ]

    def __str__(self) -> str:
        return f"{self.template} · {self.recipient} · {self.status}"


class NotificationDelivery(models.Model):
    class Status(models.TextChoices):
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    notification = models.ForeignKey(
        Notification,
        on_delete=models.CASCADE,
        related_name="deliveries",
    )
    provider = models.CharField(max_length=40)
    status = models.CharField(max_length=16, choices=Status.choices)
    provider_message_id = models.CharField(max_length=160, blank=True)
    error_code = models.CharField(max_length=80, blank=True)
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-attempted_at",)

    def __str__(self) -> str:
        return f"{self.notification_id} · {self.provider} · {self.status}"


class ContactRequest(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        RESOLVED = "resolved", "Resolved"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    name = models.CharField(max_length=160)
    email = models.EmailField()
    message = models.TextField(max_length=4000)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.email} · {self.created_at:%Y-%m-%d}"
