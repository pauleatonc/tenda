from __future__ import annotations

import threading
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import connection, connections
from django.utils import timezone

from apps.inventory.models import Product, StockBalance, StockMovement
from apps.inventory.selectors import product_for_context
from apps.inventory.services import (
    archive_product,
    create_product,
    record_stock_movement,
    restore_product,
    update_product,
)
from apps.organisations.models import Membership
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.users.models import User
from tenda.errors import DomainError, ResourceNotFound

pytestmark = pytest.mark.django_db(transaction=True)


def identity(email: str, *, role: str = Membership.Role.OWNER) -> tuple[User, TenantContext]:
    user = User.objects.create_user(
        email=email,
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    provision = create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    if role != Membership.Role.OWNER:
        provision.membership.role = role
        provision.membership.save(update_fields=("role",))
    return user, resolve_tenant_context(user)


def test_product_and_first_movement_are_created_atomically() -> None:
    _user, context = identity("owner-create@example.com")
    result = create_product(
        context=context,
        name="Termo 1L",
        purchase_price="4000",
        sale_price=0,
        initial_quantity=12,
        reason="Carga inicial",
    )

    assert result.movement is not None
    assert result.movement.movement_type == StockMovement.MovementType.ENTRY
    assert result.movement.quantity == 12
    assert result.movement.balance_after == 12
    assert result.balance.on_hand == 12
    assert result.balance.available == 12
    assert result.product.purchase_price == Decimal("4000")
    assert result.product.sale_price == Decimal("0")

    without_price = create_product(context=context, name="Termo 2L")
    assert without_price.product.sale_price is None
    assert without_price.movement is None
    assert without_price.balance.on_hand == 0


def test_replaying_an_idempotency_key_does_not_duplicate_stock() -> None:
    _user, context = identity("owner-idempotent@example.com")
    first = create_product(
        context=context,
        name="Mochila",
        initial_quantity=5,
        idempotency_key="create-mochila-001",
    )
    replay = create_product(
        context=context,
        name="Mochila",
        initial_quantity=5,
        idempotency_key="create-mochila-001",
    )

    assert replay.replayed is True
    assert replay.product.pk == first.product.pk
    assert Product.objects.filter(inventory=context.inventory).count() == 1
    assert StockMovement.objects.filter(product=first.product).count() == 1

    movement = record_stock_movement(
        context=context,
        product_id=first.product.public_id,
        movement_type=StockMovement.MovementType.EXIT,
        quantity=2,
        idempotency_key="exit-mochila-001",
    )
    movement_replay = record_stock_movement(
        context=context,
        product_id=first.product.public_id,
        movement_type=StockMovement.MovementType.EXIT,
        quantity=2,
        idempotency_key="exit-mochila-001",
    )

    assert movement_replay.replayed is True
    assert movement_replay.movement.pk == movement.movement.pk
    assert StockMovement.objects.filter(product=first.product).count() == 2
    assert StockBalance.objects.get(product=first.product).on_hand == 3

    with pytest.raises(DomainError) as conflict:
        record_stock_movement(
            context=context,
            product_id=first.product.public_id,
            movement_type=StockMovement.MovementType.EXIT,
            quantity=3,
            idempotency_key="exit-mochila-001",
        )
    assert conflict.value.code == "IDEMPOTENCY_KEY_REUSED"


def test_stock_cannot_go_negative() -> None:
    _user, context = identity("owner-negative@example.com")
    product = create_product(context=context, name="Vaso", initial_quantity=3).product

    with pytest.raises(DomainError) as insufficient:
        record_stock_movement(
            context=context,
            product_id=product.public_id,
            movement_type=StockMovement.MovementType.EXIT,
            quantity=4,
        )
    assert insufficient.value.code == "INSUFFICIENT_STOCK"
    assert StockBalance.objects.get(product=product).on_hand == 3


def test_recorded_movements_are_immutable_and_corrections_need_a_reason() -> None:
    _user, context = identity("owner-immutable@example.com")
    product = create_product(context=context, name="Libreta", initial_quantity=10).product
    movement = StockMovement.objects.get(product=product)

    movement.quantity = 99
    with pytest.raises(ValidationError):
        movement.save(update_fields=("quantity",))
    with pytest.raises(ValidationError):
        movement.delete()

    with pytest.raises(DomainError) as reason:
        record_stock_movement(
            context=context,
            product_id=product.public_id,
            movement_type=StockMovement.MovementType.CORRECTION,
            quantity=-2,
        )
    assert reason.value.field_errors["reason"] == ["Explica el motivo de este movimiento."]

    correction = record_stock_movement(
        context=context,
        product_id=product.public_id,
        movement_type=StockMovement.MovementType.CORRECTION,
        quantity=-2,
        reason="Conteo físico",
        corrects_id=movement.public_id,
    )
    assert correction.movement.quantity == -2
    assert correction.movement.balance_after == 8
    assert correction.movement.corrects_id == movement.pk

    shrinkage = record_stock_movement(
        context=context,
        product_id=product.public_id,
        movement_type=StockMovement.MovementType.SHRINKAGE,
        quantity=1,
        reason="Rotura",
    )
    assert shrinkage.movement.quantity == -1
    assert shrinkage.balance.on_hand == 7


@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="La concurrencia real se verifica sobre PostgreSQL.",
)
def test_concurrent_exits_do_not_oversell_or_lose_updates() -> None:
    _user, context = identity("owner-concurrent@example.com")
    product = create_product(context=context, name="Polerón", initial_quantity=10).product
    errors: list[DomainError] = []
    barrier = threading.Barrier(2)

    def withdraw(quantity: int) -> None:
        try:
            barrier.wait(timeout=10)
            record_stock_movement(
                context=context,
                product_id=product.public_id,
                movement_type=StockMovement.MovementType.EXIT,
                quantity=quantity,
            )
        except DomainError as exc:
            errors.append(exc)
        finally:
            connections.close_all()

    threads = [threading.Thread(target=withdraw, args=(7,)) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=20)

    balance = StockBalance.objects.get(product=product)
    assert balance.on_hand == 3
    assert [error.code for error in errors] == ["INSUFFICIENT_STOCK"]
    assert StockMovement.objects.filter(product=product).count() == 2


def test_editing_a_product_never_rewrites_stock() -> None:
    _user, context = identity("owner-edit@example.com")
    product = create_product(
        context=context,
        name="Silla",
        sale_price="25000",
        initial_quantity=4,
    ).product

    updated = update_product(
        context=context,
        product_id=product.public_id,
        name="Silla ergonómica",
        sale_price=None,
    )

    assert updated.name == "Silla ergonómica"
    assert updated.sale_price is None
    assert StockBalance.objects.get(product=product).on_hand == 4
    assert StockMovement.objects.filter(product=product).count() == 1


def test_archiving_keeps_history_and_blocks_new_movements() -> None:
    _user, context = identity("owner-archive@example.com")
    product = create_product(context=context, name="Cojín", initial_quantity=2).product

    archived = archive_product(context=context, product_id=product.public_id)
    assert archived.catalog_status == Product.CatalogStatus.ARCHIVED
    assert archived.archived_at is not None
    assert StockMovement.objects.filter(product=product).count() == 1

    with pytest.raises(DomainError) as blocked:
        record_stock_movement(
            context=context,
            product_id=product.public_id,
            movement_type=StockMovement.MovementType.ENTRY,
            quantity=1,
        )
    assert blocked.value.code == "PRODUCT_ARCHIVED"

    # The name is free again while the product stays archived.
    create_product(context=context, name="Cojín", initial_quantity=1)
    with pytest.raises(DomainError):
        restore_product(context=context, product_id=product.public_id)


def test_products_of_another_tenant_are_not_found() -> None:
    _owner, context = identity("owner-tenant-a@example.com")
    product = create_product(context=context, name="Bandeja", initial_quantity=1).product
    _other, other_context = identity("owner-tenant-b@example.com")

    with pytest.raises(ResourceNotFound):
        product_for_context(other_context, product.public_id)
    with pytest.raises(ResourceNotFound):
        record_stock_movement(
            context=other_context,
            product_id=product.public_id,
            movement_type=StockMovement.MovementType.EXIT,
            quantity=1,
        )
