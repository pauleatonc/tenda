"""Private file metadata; object bytes remain in R2-compatible storage."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class MediaAsset(models.Model):
    class Purpose(models.TextChoices):
        PRODUCT_IMAGE = "product_image", "Product image"
        PROFILE_PHOTO = "profile_photo", "Profile photo"
        ORGANISATION_LOGO = "organisation_logo", "Organisation logo"
        PAYMENT_RECEIPT = "payment_receipt", "Payment receipt"
        IMPORT_FILE = "import_file", "Import file"
        IMPORT_REPORT = "import_report", "Import report"
        INVENTORY_EXPORT = "inventory_export", "Inventory export"
        SHIPPING_LABEL = "shipping_label", "Shipping label"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending upload"
        UPLOADED = "uploaded", "Uploaded"
        READY = "ready", "Ready"
        REJECTED = "rejected", "Rejected"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.CASCADE,
        related_name="media_assets",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_media_assets",
    )
    purpose = models.CharField(max_length=32, choices=Purpose.choices)
    object_key = models.CharField(max_length=500, unique=True, editable=False)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=120)
    expected_size = models.PositiveBigIntegerField()
    actual_size = models.PositiveBigIntegerField(null=True, blank=True)
    checksum_sha256 = models.CharField(max_length=64, blank=True)
    variants = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(
                fields=("organisation", "purpose", "status"),
                name="media_asset_tenant_status_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.original_name} · {self.status}"
