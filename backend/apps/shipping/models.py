"""Tenant-owned shipments with an immutable destination snapshot."""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Shipment(models.Model):
    """One fulfilment record per paid order. Destination fields never follow BuyerSnapshot."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        PREPARING = "preparing", "En preparación"
        DISPATCHED = "dispatched", "Despachado"
        DELIVERY_CHECK = "delivery_check", "Chequeo de entrega"
        DELIVERED = "delivered", "Entregado"
        ISSUE = "issue", "Incidencia"
        RETURNED = "returned", "Devuelto"
        CANCELLED = "cancelled", "Cancelado"
        CLOSED = "closed", "Cerrado"

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
    public_token_hash = models.CharField(max_length=64, unique=True, editable=False)
    public_token_ciphertext = models.TextField(editable=False)
    public_token_expires_at = models.DateTimeField()
    dispatched_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
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
        "public_token_hash",
        "public_token_ciphertext",
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


class ShipmentEvent(models.Model):
    """Append-only timeline. Internal notes stay off the public surface."""

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.PROTECT,
        related_name="timeline",
    )
    event_type = models.CharField(max_length=80)
    from_status = models.CharField(max_length=24, blank=True)
    to_status = models.CharField(max_length=24, blank=True)
    title = models.CharField(max_length=180)
    detail = models.TextField(blank=True)
    is_public = models.BooleanField(default=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")

    def __str__(self) -> str:
        return f"{self.shipment.number} · {self.event_type}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None:
            raise ValidationError("La línea de tiempo de envío es inmutable.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise ValidationError("La línea de tiempo de envío es inmutable.")


class DeliveryConfirmation(models.Model):
    """Public buyer confirmation. Created in T3.4; the row is unique per shipment."""

    class Outcome(models.TextChoices):
        RECEIVED = "received", "Sí, lo recibí"
        NEEDS_HELP = "needs_help", "No, necesito ayuda"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    shipment = models.OneToOneField(
        Shipment,
        on_delete=models.PROTECT,
        related_name="delivery_confirmation",
    )
    outcome = models.CharField(max_length=24, choices=Outcome.choices)
    comment = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.shipment.number} · {self.outcome}"


class FollowUpSchedule(models.Model):
    """Durable cadence. due_at lives in PostgreSQL, never in Redis."""

    class Kind(models.TextChoices):
        DELIVERY_CHECK = "delivery_check", "Chequeo de entrega"
        REMINDER = "reminder", "Recordatorio"
        AUTOCLOSE = "autoclose", "Autocierre"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Programado"
        DUE = "due", "Vencido"
        SENT = "sent", "Enviado"
        CANCELLED = "cancelled", "Cancelado"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        related_name="shipment_follow_ups",
    )
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.PROTECT,
        related_name="follow_ups",
    )
    ticket = models.ForeignKey(
        "Ticket",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="follow_ups",
    )
    kind = models.CharField(max_length=32, choices=Kind.choices)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.SCHEDULED,
    )
    due_at = models.DateTimeField()
    sent_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("due_at", "id")
        indexes = [
            models.Index(
                fields=("status", "due_at"),
                name="shipping_followup_due_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.shipment.number} · {self.kind}"


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


class Ticket(models.Model):
    """One active consultation thread per shipment. Reused until resolved or closed."""

    class Status(models.TextChoices):
        OPEN = "open", "Abierto"
        AWAITING_SELLER = "awaiting_seller", "Espera al vendedor"
        AWAITING_BUYER = "awaiting_buyer", "Espera al comprador"
        RESOLVED = "resolved", "Resuelto"
        CLOSED = "closed", "Cerrado"

    class Category(models.TextChoices):
        NOT_RECEIVED = "not_received", "No llegó"
        DAMAGED = "damaged", "Llegó dañado"
        WRONG_ITEM = "wrong_item", "Producto equivocado"
        OTHER = "other", "Otra consulta"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        related_name="shipment_tickets",
    )
    inventory = models.ForeignKey(
        "inventory.Inventory",
        on_delete=models.PROTECT,
        related_name="shipment_tickets",
    )
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.PROTECT,
        related_name="tickets",
    )
    number = models.CharField(max_length=32)
    status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.OPEN,
    )
    category = models.CharField(
        max_length=24,
        choices=Category.choices,
        default=Category.OTHER,
    )
    contact_name = models.CharField(max_length=160, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=32, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    SNAPSHOT_FIELDS = (
        "organisation_id",
        "inventory_id",
        "shipment_id",
        "number",
    )

    class Meta:
        ordering = ("-created_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organisation", "number"),
                name="shipping_ticket_tenant_number_unique",
            ),
            models.UniqueConstraint(
                fields=("shipment",),
                condition=models.Q(
                    status__in=("open", "awaiting_seller", "awaiting_buyer"),
                ),
                name="shipping_ticket_open_per_shipment",
            ),
        ]
        indexes = [
            models.Index(
                fields=("organisation", "status", "-created_at"),
                name="shipping_ticket_status_idx",
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
                raise ValidationError("El ticket no permite cambiar el envío asociado.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise ValidationError("Los tickets no se eliminan.")


class TicketMessage(models.Model):
    """Append-only conversation line. Email never copies the full body."""

    class AuthorKind(models.TextChoices):
        BUYER = "buyer", "Comprador"
        SELLER = "seller", "Vendedor"
        SYSTEM = "system", "Sistema"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.PROTECT,
        related_name="messages",
    )
    author_kind = models.CharField(max_length=16, choices=AuthorKind.choices)
    body = models.TextField()
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")

    def __str__(self) -> str:
        return f"{self.ticket.number} · {self.author_kind}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None:
            raise ValidationError("Los mensajes del ticket son inmutables.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise ValidationError("Los mensajes del ticket son inmutables.")


class ReturnCase(models.Model):
    """Operational incident or return. Creating the row never restocks."""

    class Kind(models.TextChoices):
        LOST = "lost", "Pérdida"
        REJECTED = "rejected", "Rechazo"
        RETURNED = "returned", "Devolución"
        OTHER = "other", "Otro"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    organisation = models.ForeignKey(
        "organisations.Organisation",
        on_delete=models.PROTECT,
        related_name="return_cases",
    )
    inventory = models.ForeignKey(
        "inventory.Inventory",
        on_delete=models.PROTECT,
        related_name="return_cases",
    )
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.PROTECT,
        related_name="return_cases",
    )
    kind = models.CharField(max_length=24, choices=Kind.choices)
    notes = models.CharField(max_length=500, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    stock_confirmed_at = models.DateTimeField(null=True, blank=True)
    stock_confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(
                fields=("organisation", "shipment", "-created_at"),
                name="shipping_return_shipment_idx",
            )
        ]

    def __str__(self) -> str:
        return f"{self.shipment.number} · {self.kind}"

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise ValidationError("Los casos de devolución no se eliminan.")
