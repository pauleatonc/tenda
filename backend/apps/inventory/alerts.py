"""Durable low-stock state.

Reads never create alerts. Commands call ``sync_stock_alert`` after changing a
balance or threshold, which makes dashboard queries side-effect free and keeps
one active alert per product/type.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.organisations.selectors import TenantContext
from tenda.errors import DomainError

from .models import InventoryAlert, Product, StockBalance
from .selectors import product_for_context

MAX_THRESHOLD = 1_000_000_000


def _clean_threshold(value: Any, *, allow_null: bool = False) -> int | None:
    if allow_null and value in (None, ""):
        return None
    if isinstance(value, bool):
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"threshold": ["Ingresa un umbral entero de 0 o más."]},
        )
    try:
        threshold = int(str(value).strip())
    except (TypeError, ValueError) as exc:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"threshold": ["Ingresa un umbral entero de 0 o más."]},
        ) from exc
    if threshold < 0 or threshold > MAX_THRESHOLD:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"threshold": ["Ingresa un umbral entero de 0 o más."]},
        )
    return threshold


def effective_low_stock_threshold(product: Product) -> int:
    if product.low_stock_threshold is not None:
        return product.low_stock_threshold
    return product.inventory.low_stock_threshold


@transaction.atomic
def sync_stock_alert(product: Product, balance: StockBalance) -> InventoryAlert | None:
    """Open, update or resolve the single alert implied by the current balance."""

    threshold = effective_low_stock_threshold(product)
    available = balance.available
    desired: str | None
    if product.is_archived:
        desired = None
    elif available == 0:
        desired = InventoryAlert.AlertType.OUT_OF_STOCK
    elif available <= threshold:
        desired = InventoryAlert.AlertType.LOW_STOCK
    else:
        desired = None

    active = list(
        InventoryAlert.objects.select_for_update().filter(
            product=product,
            status=InventoryAlert.Status.ACTIVE,
        )
    )
    now = timezone.now()
    for alert in active:
        if alert.alert_type == desired:
            continue
        alert.status = InventoryAlert.Status.RESOLVED
        alert.resolved_at = now
        alert.save(update_fields=("status", "resolved_at", "updated_at"))

    if desired is None:
        return None
    current = next((alert for alert in active if alert.alert_type == desired), None)
    if current is None:
        return InventoryAlert.objects.create(
            inventory=product.inventory,
            product=product,
            alert_type=desired,
            threshold=threshold,
            available_quantity=available,
        )
    if current.threshold != threshold or current.available_quantity != available:
        current.threshold = threshold
        current.available_quantity = available
        current.save(update_fields=("threshold", "available_quantity", "updated_at"))
    return current


def active_stock_alerts(
    context: TenantContext,
    *,
    limit: int = 20,
) -> list[InventoryAlert]:
    """Tenant-safe alert feed. This selector is deliberately side-effect free."""

    safe_limit = min(max(limit, 1), 100)
    return list(
        InventoryAlert.objects.filter(
            inventory=context.inventory,
            status=InventoryAlert.Status.ACTIVE,
        )
        .select_related("product")
        .order_by("-opened_at", "-id")[:safe_limit]
    )


def stock_alert_history(context: TenantContext) -> QuerySet[InventoryAlert]:
    return InventoryAlert.objects.filter(inventory=context.inventory).select_related("product")


@transaction.atomic
def update_inventory_low_stock_threshold(
    *,
    context: TenantContext,
    threshold: Any,
    correlation_id: str = "",
) -> int:
    value = _clean_threshold(threshold)
    assert value is not None
    inventory = type(context.inventory).objects.select_for_update().get(pk=context.inventory.pk)
    inventory.low_stock_threshold = value
    inventory.save(update_fields=("low_stock_threshold", "updated_at"))
    products = (
        Product.objects.select_for_update(of=("self",))
        .filter(inventory=inventory)
        .select_related("inventory", "balance")
    )
    for product in products:
        balance, _created = StockBalance.objects.get_or_create(
            product=product,
            defaults={"inventory": inventory},
        )
        sync_stock_alert(product, balance)
    record_audit_event(
        action="inventory.low_stock_threshold_updated",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.inventory",
        object_public_id=str(inventory.public_id),
        correlation_id=correlation_id,
        metadata={"threshold": value},
    )
    return value


@transaction.atomic
def update_product_low_stock_threshold(
    *,
    context: TenantContext,
    product_id: uuid.UUID,
    threshold: Any,
    correlation_id: str = "",
) -> Product:
    value = _clean_threshold(threshold, allow_null=True)
    product = product_for_context(context, product_id)
    product = Product.objects.select_for_update().select_related("inventory").get(pk=product.pk)
    product.low_stock_threshold = value
    product.save(update_fields=("low_stock_threshold", "updated_at"))
    balance, _created = StockBalance.objects.get_or_create(
        product=product,
        defaults={"inventory": context.inventory},
    )
    sync_stock_alert(product, balance)
    record_audit_event(
        action="inventory.product_threshold_updated",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.product",
        object_public_id=str(product.public_id),
        correlation_id=correlation_id,
        metadata={
            "threshold": value,
            "effectiveThreshold": effective_low_stock_threshold(product),
        },
    )
    return product
