"""Transactional inventory schema commands.

Product and stock commands arrive with T1.2, where a catalogue entry and its
first movement must be created inside one transaction.
"""

from __future__ import annotations

import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.idempotency import execute_idempotent
from apps.audit.services import record_audit_event
from apps.organisations.permissions import OrganisationPermission, require_permission
from apps.organisations.selectors import TenantContext
from tenda.errors import DomainError

from .alerts import sync_stock_alert
from .custom_fields import (
    clean_field_type,
    clean_key,
    clean_label,
    clean_options,
    clean_value,
    validate_extra_attributes,
    validation_error,
)
from .models import CustomFieldDefinition, Product, StockBalance, StockMovement
from .selectors import (
    active_custom_fields,
    custom_field_for_context,
    custom_fields_for_inventory,
    product_for_context,
)

MAX_PRICE = Decimal("999999999999")
MAX_MOVEMENT_QUANTITY = 1_000_000_000

#: Distinguishes "field not sent" from "field explicitly cleared to null".
UNSET: Any = object()


def _limit_error() -> DomainError:
    return DomainError(
        "CUSTOM_FIELD_LIMIT_REACHED",
        (
            "Este inventario ya usa las "
            f"{CustomFieldDefinition.MAX_ACTIVE_PER_INVENTORY} columnas disponibles."
        ),
        field_errors={
            "customFields": [
                "Desactiva una columna antes de agregar o reactivar otra.",
            ]
        },
        status=409,
    )


def _backfill_error() -> DomainError:
    return DomainError(
        "CUSTOM_FIELD_BACKFILL_REQUIRED",
        "Para volver obligatoria una columna necesitas un valor por defecto.",
        field_errors={
            "defaultValue": [
                "Entrega un valor por defecto para los productos existentes.",
            ]
        },
        status=409,
    )


def _duplicate_error(exc: IntegrityError) -> DomainError:
    message = str(exc)
    if "custom_field_unique_label_per_inventory" in message:
        return validation_error("label", "Ya existe una columna con ese nombre.")
    if "custom_field_unique_key_per_inventory" in message:
        return validation_error("key", "Ya existe una columna con esa clave.")
    return DomainError("VALIDATION_ERROR", "Revisa los datos ingresados.")


def _assert_active_slot_available(
    context: TenantContext,
    *,
    exclude_pk: int | None = None,
) -> None:
    active = CustomFieldDefinition.objects.select_for_update().filter(
        inventory=context.inventory,
        is_active=True,
    )
    if exclude_pk is not None:
        active = active.exclude(pk=exclude_pk)
    if active.count() >= CustomFieldDefinition.MAX_ACTIVE_PER_INVENTORY:
        raise _limit_error()


def _next_position(context: TenantContext) -> int:
    last = (
        CustomFieldDefinition.objects.filter(inventory=context.inventory)
        .order_by("-position")
        .values_list("position", flat=True)
        .first()
    )
    return int(last or 0) + 1


def _value_is_missing(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _products_missing_value(context: TenantContext, key: str) -> bool:
    for attributes in Product.objects.filter(inventory=context.inventory).values_list(
        "extra_attributes",
        flat=True,
    ):
        if _value_is_missing((attributes or {}).get(key)):
            return True
    return False


def _backfill_products(
    context: TenantContext,
    definition: CustomFieldDefinition,
    default_value: Any,
) -> int:
    """Fill the new required value only where it is missing."""

    stored = clean_value(definition, default_value)
    updated = 0
    products = (
        Product.objects.select_for_update().filter(inventory=context.inventory).order_by("pk")
    )
    for product in products:
        attributes = dict(product.extra_attributes or {})
        if not _value_is_missing(attributes.get(definition.key)):
            continue
        attributes[definition.key] = stored
        product.extra_attributes = attributes
        product.save(update_fields=("extra_attributes", "updated_at"))
        updated += 1
    return updated


@transaction.atomic
def create_custom_field(
    *,
    context: TenantContext,
    label: str,
    field_type: str,
    key: str = "",
    options: Sequence[Mapping[str, Any]] | None = None,
    help_text: str = "",
    is_required: bool = False,
    is_visible: bool = True,
    is_filterable: bool = False,
    default_value: Any = None,
) -> CustomFieldDefinition:
    require_permission(context.membership, OrganisationPermission.MANAGE_INVENTORY_SCHEMA)
    label_value = clean_label(label)
    type_value = clean_field_type(field_type)
    key_value = clean_key(key or label_value)
    option_values = clean_options(type_value, options)
    _assert_active_slot_available(context)

    needs_backfill = is_required and Product.objects.filter(inventory=context.inventory).exists()
    if needs_backfill and default_value is None:
        raise _backfill_error()

    try:
        with transaction.atomic():
            definition = CustomFieldDefinition.objects.create(
                inventory=context.inventory,
                key=key_value,
                label=label_value,
                field_type=type_value,
                options=option_values,
                help_text=" ".join(help_text.split())[:160],
                is_required=is_required,
                is_visible=is_visible,
                is_filterable=is_filterable,
                position=_next_position(context),
            )
    except IntegrityError as exc:
        raise _duplicate_error(exc) from exc

    backfilled = _backfill_products(context, definition, default_value) if needs_backfill else 0
    record_audit_event(
        action="inventory.custom_field_created",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.custom_field",
        object_public_id=str(definition.public_id),
        metadata={
            "key": definition.key,
            "fieldType": definition.field_type,
            "backfilledProducts": backfilled,
        },
    )
    return definition


@transaction.atomic
def update_custom_field(
    *,
    context: TenantContext,
    field_id: uuid.UUID,
    label: str | None = None,
    options: Sequence[Mapping[str, Any]] | None = None,
    help_text: str | None = None,
    is_required: bool | None = None,
    is_visible: bool | None = None,
    is_filterable: bool | None = None,
    is_active: bool | None = None,
    default_value: Any = None,
) -> CustomFieldDefinition:
    """Update presentation and rules. The key and the type never change."""

    require_permission(context.membership, OrganisationPermission.MANAGE_INVENTORY_SCHEMA)
    definition = custom_field_for_context(context, field_id)
    definition = CustomFieldDefinition.objects.select_for_update().get(pk=definition.pk)
    changes: list[str] = []

    if is_active is not None and is_active != definition.is_active:
        if is_active:
            _assert_active_slot_available(context, exclude_pk=definition.pk)
        definition.is_active = is_active
        changes.append("is_active")

    if label is not None:
        definition.label = clean_label(label)
        changes.append("label")

    if options is not None:
        definition.options = clean_options(definition.field_type, options)
        changes.append("options")

    if help_text is not None:
        definition.help_text = " ".join(help_text.split())[:160]
        changes.append("help_text")

    if is_visible is not None:
        definition.is_visible = is_visible
        changes.append("is_visible")

    if is_filterable is not None:
        definition.is_filterable = is_filterable
        changes.append("is_filterable")

    backfilled = 0
    if is_required is not None and is_required != definition.is_required:
        if (
            is_required
            and definition.is_active
            and _products_missing_value(context, definition.key)
        ):
            if default_value is None:
                raise _backfill_error()
            backfilled = _backfill_products(context, definition, default_value)
        definition.is_required = is_required
        changes.append("is_required")

    if not changes:
        return definition

    try:
        with transaction.atomic():
            definition.save(update_fields=(*changes, "updated_at"))
    except IntegrityError as exc:
        raise _duplicate_error(exc) from exc
    record_audit_event(
        action="inventory.custom_field_updated",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.custom_field",
        object_public_id=str(definition.public_id),
        metadata={
            "key": definition.key,
            "changed": sorted(changes),
            "backfilledProducts": backfilled,
        },
    )
    return definition


@transaction.atomic
def reorder_custom_fields(
    *,
    context: TenantContext,
    field_ids: Sequence[uuid.UUID],
) -> list[CustomFieldDefinition]:
    require_permission(context.membership, OrganisationPermission.MANAGE_INVENTORY_SCHEMA)
    definitions = {
        definition.public_id: definition
        for definition in custom_fields_for_inventory(context).select_for_update()
    }
    requested = list(dict.fromkeys(field_ids))
    if set(requested) != set(definitions):
        raise validation_error("fieldIds", "Incluye todas las columnas del inventario.")
    ordered: list[CustomFieldDefinition] = []
    for position, field_id in enumerate(requested, start=1):
        definition = definitions[field_id]
        if definition.position != position:
            definition.position = position
            definition.save(update_fields=("position", "updated_at"))
        ordered.append(definition)
    record_audit_event(
        action="inventory.custom_fields_reordered",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.inventory",
        object_public_id=str(context.inventory.public_id),
        metadata={"count": len(ordered)},
    )
    return ordered


@dataclass(frozen=True, slots=True)
class StockMovementResult:
    movement: StockMovement
    balance: StockBalance
    replayed: bool


@dataclass(frozen=True, slots=True)
class ProductResult:
    product: Product
    balance: StockBalance
    movement: StockMovement | None
    replayed: bool


@dataclass(frozen=True, slots=True)
class StockRequest:
    """One requested quantity; repeated products are aggregated before locking."""

    product: Product
    quantity: int


@dataclass(frozen=True, slots=True)
class StockConsumption:
    product: Product
    quantity: int
    movement: StockMovement
    balance: StockBalance


def _aggregate_stock_requests(
    context: TenantContext,
    requests: Sequence[StockRequest],
) -> tuple[dict[int, int], dict[int, Product]]:
    quantities: dict[int, int] = {}
    products: dict[int, Product] = {}
    for request in requests:
        product = request.product
        if (
            product.pk is None
            or product.inventory_id != context.inventory.pk
            or product.inventory.organisation_id != context.organisation.pk
        ):
            raise DomainError("NOT_FOUND", "No encontramos el recurso solicitado.", status=404)
        if isinstance(request.quantity, bool) or request.quantity <= 0:
            raise validation_error("quantity", "La cantidad debe ser positiva.")
        quantities[product.pk] = quantities.get(product.pk, 0) + request.quantity
        products[product.pk] = product
    if not quantities:
        raise validation_error("lines", "Agrega al menos un producto.")
    return quantities, products


def _locked_stock_balances(
    context: TenantContext,
    product_ids: Sequence[int],
) -> dict[int, StockBalance]:
    """Lock every balance in product-id order to keep concurrent carts deadlock-safe."""

    ordered_ids = sorted(set(product_ids))
    existing = set(
        StockBalance.objects.filter(
            inventory=context.inventory,
            product_id__in=ordered_ids,
        ).values_list("product_id", flat=True)
    )
    for product_id in ordered_ids:
        if product_id not in existing:
            StockBalance.objects.get_or_create(
                product_id=product_id,
                defaults={"inventory": context.inventory},
            )
    balances = list(
        StockBalance.objects.select_for_update()
        .filter(
            inventory=context.inventory,
            product_id__in=ordered_ids,
        )
        .select_related("product", "product__inventory")
        .order_by("product_id")
    )
    if len(balances) != len(ordered_ids):
        raise DomainError("NOT_FOUND", "No encontramos el recurso solicitado.", status=404)
    return {balance.product_id: balance for balance in balances}


@transaction.atomic
def reserve_stock(
    *,
    context: TenantContext,
    requests: Sequence[StockRequest],
) -> dict[int, StockBalance]:
    """Atomically reserve aggregate quantities without changing on-hand stock."""

    quantities, _products = _aggregate_stock_requests(context, requests)
    balances = _locked_stock_balances(context, list(quantities))
    errors: dict[str, list[str]] = {}
    for product_id in sorted(quantities):
        balance = balances[product_id]
        quantity = quantities[product_id]
        if balance.available < quantity:
            errors[str(balance.product.public_id)] = [f"Disponible actual: {balance.available}."]
    if errors:
        raise DomainError(
            "INSUFFICIENT_STOCK",
            "No hay unidades suficientes para reservar esta venta.",
            field_errors={"products": [f"{key}: {value[0]}" for key, value in errors.items()]},
            status=409,
        )
    for product_id in sorted(quantities):
        balance = balances[product_id]
        balance.reserved += quantities[product_id]
        balance.save(update_fields=("reserved", "updated_at"))
        sync_stock_alert(balance.product, balance)
    return balances


@transaction.atomic
def release_stock(
    *,
    context: TenantContext,
    requests: Sequence[StockRequest],
) -> dict[int, StockBalance]:
    """Release active reservations once; callers guard their durable rows."""

    quantities, _products = _aggregate_stock_requests(context, requests)
    balances = _locked_stock_balances(context, list(quantities))
    for product_id in sorted(quantities):
        balance = balances[product_id]
        quantity = quantities[product_id]
        if balance.reserved < quantity:
            raise DomainError(
                "STOCK_RECONCILIATION_REQUIRED",
                "La reserva de inventario no coincide con el pedido.",
                status=409,
                retryable=True,
            )
    for product_id in sorted(quantities):
        balance = balances[product_id]
        balance.reserved -= quantities[product_id]
        balance.save(update_fields=("reserved", "updated_at"))
        sync_stock_alert(balance.product, balance)
    return balances


@transaction.atomic
def consume_stock(
    *,
    context: TenantContext,
    requests: Sequence[StockRequest],
    reference_type: str,
    reference_public_id: str,
    reason: str = "Venta confirmada",
    correlation_id: str = "",
) -> list[StockConsumption]:
    """Convert reservations to immutable exits in one ordered-lock transaction."""

    quantities, products = _aggregate_stock_requests(context, requests)
    balances = _locked_stock_balances(context, list(quantities))
    for product_id in sorted(quantities):
        balance = balances[product_id]
        quantity = quantities[product_id]
        if balance.reserved < quantity or balance.on_hand < quantity:
            raise DomainError(
                "STOCK_RECONCILIATION_REQUIRED",
                "El stock reservado no permite confirmar esta venta.",
                status=409,
                retryable=True,
            )

    consumed: list[StockConsumption] = []
    for product_id in sorted(quantities):
        quantity = quantities[product_id]
        balance = balances[product_id]
        balance.reserved -= quantity
        balance.on_hand -= quantity
        movement = StockMovement.objects.create(
            inventory=context.inventory,
            product=products[product_id],
            movement_type=StockMovement.MovementType.EXIT,
            quantity=-quantity,
            balance_after=balance.on_hand,
            reason=reason[:120],
            actor=context.user,
            reference_type=reference_type[:40],
            reference_public_id=reference_public_id[:80],
            correlation_id=correlation_id[:100],
        )
        balance.save(update_fields=("reserved", "on_hand", "updated_at"))
        sync_stock_alert(balance.product, balance)
        consumed.append(
            StockConsumption(
                product=products[product_id],
                quantity=quantity,
                movement=movement,
                balance=balance,
            )
        )
    return consumed


def _clean_name(value: str) -> str:
    name = " ".join(value.split())
    if not name:
        raise validation_error("name", "Ingresa el nombre del producto.")
    if len(name) > 160:
        raise validation_error("name", "Usa un nombre de hasta 160 caracteres.")
    return name


def _clean_catalog_status(value: str) -> str:
    if value in {Product.CatalogStatus.ACTIVE, Product.CatalogStatus.INACTIVE}:
        return value
    raise validation_error("catalogStatus", "Selecciona un estado de catálogo válido.")


def _duplicate_product_error() -> DomainError:
    return DomainError(
        "PRODUCT_NAME_TAKEN",
        "Ya existe un producto con ese nombre en el inventario.",
        field_errors={"name": ["Usa un nombre distinto o reactiva el producto archivado."]},
        status=409,
    )


def _clean_quantity(value: Any, *, allow_negative: bool, field: str = "quantity") -> int:
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise validation_error(field, "Ingresa una cantidad válida.")
    try:
        quantity = int(str(value).strip())
    except ValueError as exc:
        raise validation_error(field, "Ingresa una cantidad válida.") from exc
    if quantity == 0:
        raise validation_error(field, "La cantidad debe ser distinta de cero.")
    if not allow_negative and quantity < 0:
        raise validation_error(field, "La cantidad debe ser positiva.")
    if abs(quantity) > MAX_MOVEMENT_QUANTITY:
        raise validation_error(field, "La cantidad es demasiado alta.")
    return quantity


def _signed_quantity(movement_type: str, quantity: int) -> int:
    if movement_type in StockMovement.NEGATIVE_TYPES:
        return -abs(quantity)
    if movement_type in StockMovement.POSITIVE_TYPES:
        return abs(quantity)
    return quantity


def _locked_balance(product: Product) -> StockBalance:
    balance = StockBalance.objects.select_for_update().filter(product=product).first()
    if balance is None:
        StockBalance.objects.get_or_create(
            product=product,
            defaults={"inventory": product.inventory},
        )
        balance = StockBalance.objects.select_for_update().get(product=product)
    return balance


def _append_movement(
    *,
    context: TenantContext,
    product: Product,
    movement_type: str,
    quantity: int,
    reason: str,
    note: str,
    reference_type: str = "",
    reference_public_id: str = "",
    corrects: StockMovement | None = None,
    correlation_id: str = "",
) -> StockMovementResult:
    """Append one immutable movement and move the saldo in the same transaction."""

    balance = _locked_balance(product)
    new_on_hand = balance.on_hand + quantity
    if new_on_hand < 0:
        raise DomainError(
            "INSUFFICIENT_STOCK",
            "No hay unidades suficientes para registrar esta salida.",
            field_errors={"quantity": [f"Disponible actual: {balance.available}."]},
            status=409,
        )
    if new_on_hand < balance.reserved:
        raise DomainError(
            "STOCK_RESERVED",
            "Las unidades restantes están reservadas en una venta activa.",
            field_errors={"quantity": [f"Disponible actual: {balance.available}."]},
            status=409,
        )
    movement = StockMovement.objects.create(
        inventory=product.inventory,
        product=product,
        movement_type=movement_type,
        quantity=quantity,
        balance_after=new_on_hand,
        reason=reason[:120],
        note=note[:280],
        actor=context.user,
        reference_type=reference_type[:40],
        reference_public_id=reference_public_id[:80],
        corrects=corrects,
        correlation_id=correlation_id[:100],
    )
    balance.on_hand = new_on_hand
    balance.save(update_fields=("on_hand", "updated_at"))
    return StockMovementResult(movement=movement, balance=balance, replayed=False)


@transaction.atomic
def _create_product(
    *,
    context: TenantContext,
    name: str,
    catalog_status: str,
    purchase_price: Decimal | None,
    sale_price: Decimal | None,
    extra_attributes: dict[str, Any],
    initial_quantity: int,
    reason: str,
    note: str,
    correlation_id: str,
) -> ProductResult:
    try:
        with transaction.atomic():
            product = Product.objects.create(
                inventory=context.inventory,
                name=name,
                catalog_status=catalog_status,
                purchase_price=purchase_price,
                sale_price=sale_price,
                extra_attributes=extra_attributes,
                created_by=context.user,
            )
    except IntegrityError as exc:
        raise _duplicate_product_error() from exc
    balance = StockBalance.objects.create(product=product, inventory=context.inventory)
    movement: StockMovement | None = None
    if initial_quantity:
        result = _append_movement(
            context=context,
            product=product,
            movement_type=StockMovement.MovementType.ENTRY,
            quantity=initial_quantity,
            reason=reason or "Carga inicial",
            note=note,
            correlation_id=correlation_id,
        )
        movement = result.movement
        balance = result.balance
    sync_stock_alert(product, balance)
    record_audit_event(
        action="inventory.product_created",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.product",
        object_public_id=str(product.public_id),
        correlation_id=correlation_id,
        metadata={"initialQuantity": initial_quantity},
    )
    return ProductResult(product=product, balance=balance, movement=movement, replayed=False)


def create_product(
    *,
    context: TenantContext,
    name: str,
    catalog_status: str = Product.CatalogStatus.ACTIVE,
    purchase_price: Any = None,
    sale_price: Any = None,
    extra_attributes: Mapping[str, Any] | None = None,
    initial_quantity: Any = 0,
    reason: str = "",
    note: str = "",
    idempotency_key: str = "",
    correlation_id: str = "",
) -> ProductResult:
    """Create a catalogue entry and its first movement atomically."""

    clean_name_value = _clean_name(name)
    status_value = _clean_catalog_status(catalog_status)
    purchase = clean_reference_price(purchase_price, field="purchasePrice")
    sale = clean_reference_price(sale_price, field="salePrice")
    attributes = validate_extra_attributes(active_custom_fields(context), extra_attributes)
    quantity = (
        0
        if initial_quantity in (None, "", 0)
        else _clean_quantity(initial_quantity, allow_negative=False, field="initialQuantity")
    )

    def command() -> tuple[dict[str, Any], int]:
        result = _create_product(
            context=context,
            name=clean_name_value,
            catalog_status=status_value,
            purchase_price=purchase,
            sale_price=sale,
            extra_attributes=attributes,
            initial_quantity=quantity,
            reason=reason,
            note=note,
            correlation_id=correlation_id,
        )
        return (
            {
                "productId": str(result.product.public_id),
                "movementId": (str(result.movement.public_id) if result.movement else None),
            },
            201,
        )

    if not idempotency_key:
        return _create_product(
            context=context,
            name=clean_name_value,
            catalog_status=status_value,
            purchase_price=purchase,
            sale_price=sale,
            extra_attributes=attributes,
            initial_quantity=quantity,
            reason=reason,
            note=note,
            correlation_id=correlation_id,
        )

    outcome = execute_idempotent(
        context=context,
        scope="inventory.create_product",
        key=idempotency_key,
        request_payload={
            "name": clean_name_value.casefold(),
            "catalogStatus": status_value,
            "purchasePrice": str(purchase) if purchase is not None else None,
            "salePrice": str(sale) if sale is not None else None,
            "extraAttributes": attributes,
            "initialQuantity": quantity,
        },
        command=command,
    )
    product = product_for_context(context, uuid.UUID(str(outcome.payload["productId"])))
    movement_id = outcome.payload.get("movementId")
    movement = (
        StockMovement.objects.filter(
            product=product,
            public_id=uuid.UUID(str(movement_id)),
        ).first()
        if movement_id
        else None
    )
    return ProductResult(
        product=product,
        balance=_balance_for(product),
        movement=movement,
        replayed=outcome.replayed,
    )


def _balance_for(product: Product) -> StockBalance:
    balance, _created = StockBalance.objects.get_or_create(
        product=product,
        defaults={"inventory": product.inventory},
    )
    return balance


@transaction.atomic
def update_product(
    *,
    context: TenantContext,
    product_id: uuid.UUID,
    name: str | None = None,
    catalog_status: str | None = None,
    purchase_price: Any = UNSET,
    sale_price: Any = UNSET,
    extra_attributes: Mapping[str, Any] | None = None,
    correlation_id: str = "",
) -> Product:
    """Edit the catalogue entry. Quantities never change here."""

    product = product_for_context(context, product_id)
    product = Product.objects.select_for_update().get(pk=product.pk)
    if product.is_archived:
        raise DomainError(
            "PRODUCT_ARCHIVED",
            "Reactiva el producto antes de editarlo.",
            status=409,
        )
    changes: list[str] = []
    if name is not None:
        product.name = _clean_name(name)
        changes.append("name")
    if catalog_status is not None:
        product.catalog_status = _clean_catalog_status(catalog_status)
        changes.append("catalog_status")
    if purchase_price is not UNSET:
        product.purchase_price = clean_reference_price(purchase_price, field="purchasePrice")
        changes.append("purchase_price")
    if sale_price is not UNSET:
        product.sale_price = clean_reference_price(sale_price, field="salePrice")
        changes.append("sale_price")
    if extra_attributes is not None:
        product.extra_attributes = validate_extra_attributes(
            active_custom_fields(context),
            extra_attributes,
            preserved=product.extra_attributes,
        )
        changes.append("extra_attributes")
    if not changes:
        return product
    try:
        with transaction.atomic():
            product.save(update_fields=(*changes, "updated_at"))
    except IntegrityError as exc:
        raise _duplicate_product_error() from exc
    record_audit_event(
        action="inventory.product_updated",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.product",
        object_public_id=str(product.public_id),
        correlation_id=correlation_id,
        metadata={"changed": sorted(changes)},
    )
    return product


def record_stock_movement(
    *,
    context: TenantContext,
    product_id: uuid.UUID,
    movement_type: str,
    quantity: Any,
    reason: str = "",
    note: str = "",
    corrects_id: uuid.UUID | None = None,
    reference_type: str = "",
    reference_public_id: str = "",
    idempotency_key: str = "",
    correlation_id: str = "",
) -> StockMovementResult:
    """Register an entry, exit, shrinkage or correction exactly once."""

    valid_types = {choice for choice, _label in StockMovement.MovementType.choices}
    if movement_type not in valid_types:
        raise validation_error("movementType", "Selecciona un tipo de movimiento válido.")
    is_correction = movement_type == StockMovement.MovementType.CORRECTION
    magnitude = _clean_quantity(quantity, allow_negative=is_correction)
    clean_reason = " ".join(reason.split())
    if (
        movement_type
        in {
            StockMovement.MovementType.CORRECTION,
            StockMovement.MovementType.SHRINKAGE,
        }
        and not clean_reason
    ):
        raise validation_error("reason", "Explica el motivo de este movimiento.")
    signed = _signed_quantity(movement_type, magnitude)

    def command() -> tuple[dict[str, Any], int]:
        result = _record_stock_movement(
            context=context,
            product_id=product_id,
            movement_type=movement_type,
            signed_quantity=signed,
            reason=clean_reason,
            note=note,
            corrects_id=corrects_id,
            reference_type=reference_type,
            reference_public_id=reference_public_id,
            correlation_id=correlation_id,
        )
        return {"movementId": str(result.movement.public_id)}, 201

    if not idempotency_key:
        return _record_stock_movement(
            context=context,
            product_id=product_id,
            movement_type=movement_type,
            signed_quantity=signed,
            reason=clean_reason,
            note=note,
            corrects_id=corrects_id,
            reference_type=reference_type,
            reference_public_id=reference_public_id,
            correlation_id=correlation_id,
        )

    outcome = execute_idempotent(
        context=context,
        scope="inventory.record_stock_movement",
        key=idempotency_key,
        request_payload={
            "productId": str(product_id),
            "movementType": movement_type,
            "quantity": signed,
            "reason": clean_reason,
        },
        command=command,
    )
    movement = StockMovement.objects.filter(
        inventory=context.inventory,
        public_id=uuid.UUID(str(outcome.payload["movementId"])),
    ).first()
    if movement is None:
        raise DomainError(
            "MOVEMENT_NOT_FOUND",
            "No encontramos el movimiento registrado.",
            status=404,
        )
    return StockMovementResult(
        movement=movement,
        balance=_balance_for(movement.product),
        replayed=outcome.replayed,
    )


@transaction.atomic
def _record_stock_movement(
    *,
    context: TenantContext,
    product_id: uuid.UUID,
    movement_type: str,
    signed_quantity: int,
    reason: str,
    note: str,
    corrects_id: uuid.UUID | None,
    reference_type: str,
    reference_public_id: str,
    correlation_id: str,
) -> StockMovementResult:
    product = product_for_context(context, product_id)
    if product.is_archived:
        raise DomainError(
            "PRODUCT_ARCHIVED",
            "Reactiva el producto antes de mover su stock.",
            status=409,
        )
    corrects: StockMovement | None = None
    if corrects_id is not None:
        corrects = StockMovement.objects.filter(
            inventory=context.inventory,
            product=product,
            public_id=corrects_id,
        ).first()
        if corrects is None:
            raise validation_error("correctsId", "No encontramos el movimiento a corregir.")
    result = _append_movement(
        context=context,
        product=product,
        movement_type=movement_type,
        quantity=signed_quantity,
        reason=reason,
        note=note,
        reference_type=reference_type,
        reference_public_id=reference_public_id,
        corrects=corrects,
        correlation_id=correlation_id,
    )
    sync_stock_alert(product, result.balance)
    record_audit_event(
        action="inventory.stock_movement_recorded",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.stock_movement",
        object_public_id=str(result.movement.public_id),
        correlation_id=correlation_id,
        metadata={
            "productId": str(product.public_id),
            "movementType": movement_type,
            "quantity": signed_quantity,
            "balanceAfter": result.movement.balance_after,
        },
    )
    return result


@transaction.atomic
def archive_product(
    *,
    context: TenantContext,
    product_id: uuid.UUID,
    correlation_id: str = "",
) -> Product:
    """Archive instead of deleting: history and references stay readable."""

    product = product_for_context(context, product_id)
    product = Product.objects.select_for_update().get(pk=product.pk)
    if product.is_archived:
        return product
    balance = _locked_balance(product)
    if balance.reserved > 0:
        raise DomainError(
            "PRODUCT_HAS_ACTIVE_RESERVATIONS",
            "El producto tiene unidades reservadas en ventas activas.",
            status=409,
        )
    product.catalog_status = Product.CatalogStatus.ARCHIVED
    product.archived_at = timezone.now()
    product.save(update_fields=("catalog_status", "archived_at", "updated_at"))
    sync_stock_alert(product, balance)
    record_audit_event(
        action="inventory.product_archived",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.product",
        object_public_id=str(product.public_id),
        correlation_id=correlation_id,
        metadata={"onHand": balance.on_hand},
    )
    return product


@transaction.atomic
def restore_product(
    *,
    context: TenantContext,
    product_id: uuid.UUID,
    correlation_id: str = "",
) -> Product:
    product = product_for_context(context, product_id)
    product = Product.objects.select_for_update().get(pk=product.pk)
    if not product.is_archived:
        return product
    product.catalog_status = Product.CatalogStatus.ACTIVE
    product.archived_at = None
    try:
        with transaction.atomic():
            product.save(update_fields=("catalog_status", "archived_at", "updated_at"))
    except IntegrityError as exc:
        raise _duplicate_product_error() from exc
    sync_stock_alert(product, _locked_balance(product))
    record_audit_event(
        action="inventory.product_restored",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.product",
        object_public_id=str(product.public_id),
        correlation_id=correlation_id,
    )
    return product


def clean_reference_price(value: Any, *, field: str) -> Decimal | None:
    """CLP is integral: null and 0 are different and fractions are rejected."""

    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, bool):
        raise validation_error(field, "Ingresa un monto válido en pesos.")
    try:
        amount = Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        raise validation_error(field, "Ingresa un monto válido en pesos.") from exc
    if not amount.is_finite():
        raise validation_error(field, "Ingresa un monto válido en pesos.")
    if amount != amount.to_integral_value():
        raise validation_error(field, "Los montos en pesos no aceptan decimales.")
    if amount < 0:
        raise validation_error(field, "El monto no puede ser negativo.")
    if amount > MAX_PRICE:
        raise validation_error(field, "El monto es demasiado alto.")
    return amount.to_integral_value()
