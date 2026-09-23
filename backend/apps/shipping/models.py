"""Tenant-owned shipments with an immutable destination snapshot."""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import ValidationError
from django.db import models


class Shipment(models.Model):
    """One fulfilment record per paid order. Destination fields never follow BuyerSnapshot.

    The lifecycle is a single step: ``pending`` until the seller registers the
    dispatch (``dispatched``) or the hand-over for pickup / coordinated orders
    (``delivered``). Both are terminal.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        DISPATCHED = "dispatched", "Despachado"
        DELIVERED = "delivered", "Entregado"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        related_name="shipments",
    )
    inventory = models.ForeignKey(
        "inventory.Inventory",
        on_delete=models.PROTECT,
        related_name="shipments",
    )
    order = models.OneToOneField(
        "sales.Order",
        on_delete=models.PROTECT,
        related_name="shipment",
    )
    number = models.CharField(max_length=32)
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.PENDING,
    )
    delivery_mode = models.CharField(max_length=16)
    recipient_name = models.CharField(max_length=160, blank=True)
    recipient_tax_id = models.CharField(max_length=16, blank=True)
    address_line = models.CharField(max_length=240, blank=True)
    commune = models.CharField(max_length=120, blank=True)
    region = models.CharField(max_length=120, blank=True)
    delivery_notes = models.CharField(max_length=500, blank=True)
    carrier = models.CharField(max_length=120, blank=True)
    tracking_code = models.CharField(max_length=120, blank=True)
    tracking_url = models.URLField(blank=True)
    dispatch_note = models.CharField(max_length=500, blank=True)
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    SNAPSHOT_FIELDS = (
        "organisation_id",
        "inventory_id",
        "order_id",
        "number",
        "delivery_mode",
        "recipient_name",
        "recipient_tax_id",
        "address_line",
        "commune",
        "region",
        "delivery_notes",
    )

    class Meta:
        ordering = ("-created_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organisation", "number"),
                name="shipping_shipment_tenant_number_unique",
            )
        ]
        indexes = [
            models.Index(
                fields=("organisation", "status", "-created_at"),
                name="shipping_shipment_status_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.number} · {self.status}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None:
            previous = type(self).objects.only(*self.SNAPSHOT_FIELDS).get(pk=self.pk)
            if any(
                getattr(previous, field) != getattr(self, field) for field in self.SNAPSHOT_FIELDS
            ):
                raise ValidationError("El snapshot de destino del envío es inmutable.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise ValidationError("Los envíos no se eliminan.")


class LabelDocument(models.Model):
    """Internal Tenda packing label. Never a carrier document."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        related_name="shipment_labels",
    )
    inventory = models.ForeignKey(
        "inventory.Inventory",
        on_delete=models.PROTECT,
        related_name="shipment_labels",
    )
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.PROTECT,
        related_name="labels",
    )
    asset = models.OneToOneField(
        "media_assets.MediaAsset",
        on_delete=models.PROTECT,
        related_name="shipping_label",
    )
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(
                fields=("organisation", "shipment", "-created_at"),
                name="shipping_label_shipment_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.shipment.number} · etiqueta"
