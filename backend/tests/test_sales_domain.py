from __future__ import annotations

import threading
from datetime import timedelta

import pytest
from django.db import connection, connections
from django.utils import timezone

from apps.inventory.models import StockBalance, StockMovement
from apps.inventory.services import create_product
from apps.media_assets.storage import fake_object_storage
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.sales.models import Order, OrderEvent, OrderItem, PaymentProof, StockReservation
from apps.sales.order_services import (
    cancel_order,
    confirm_manual_payment,
    create_order,
    expire_order,
    public_order_for_token,
    restore_order,
    review_payment_proof,
    set_buyer_details,
)
from apps.sales.uploads import (
    accept_fake_receipt_upload,
    complete_receipt_upload,
    prepare_receipt_upload,
)
from apps.users.models import User
from tenda.crypto import decrypt_credential
from tenda.errors import DomainError, ResourceNotFound

pytestmark = pytest.mark.django_db(transaction=True)


def seed_bank_details(organisation) -> None:
    organisation.bank_name = "BancoEstado"
    organisation.bank_account_type = "cuenta_corriente"
    organisation.bank_account_number = "12345678"
    organisation.bank_holder_tax_id = "11.111.111-1"
    organisation.bank_confirmation_email = "pagos@example.com"
    organisation.save(
        update_fields=(
            "bank_name",
            "bank_account_type",
            "bank_account_number",
            "bank_holder_tax_id",
            "bank_confirmation_email",
            "updated_at",
        )
    )


def identity(email: str) -> tuple[User, TenantContext]:
    user = User.objects.create_user(
        email=email,
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    context = resolve_tenant_context(user)
    seed_bank_details(context.organisation)
    return user, context


def order_for(
    context: TenantContext,
    *,
    product_name: str,
    quantity: int = 5,
    requested: int = 1,
    price: str = "1000",
    method: str = Order.PaymentMethod.CASH,
) -> tuple[Order, object]:
    product = create_product(
        context=context,
        name=product_name,
        purchase_price="400",
        sale_price=price,
        initial_quantity=quantity,
    ).product
    result = create_order(
        context=context,
        lines=[
            {
                "productId": str(product.public_id),
                "quantity": requested,
                "unitSalePrice": price,
            }
        ],
        delivery_mode=Order.DeliveryMode.PICKUP,
        payment_method=method,
        idempotency_key=f"create-{product.public_id}",
    )
    return result.order, product


def test_duplicate_product_lines_keep_prices_but_reserve_aggregate_once() -> None:
    _user, context = identity("sales-lines@example.com")
    product = create_product(
        context=context,
        name="Tazón",
        purchase_price="700",
        sale_price="1500",
        initial_quantity=5,
    ).product
    lines = [
        {"productId": str(product.public_id), "quantity": 1, "unitSalePrice": "1200"},
        {"productId": str(product.public_id), "quantity": 2, "unitSalePrice": "1000"},
    ]

    first = create_order(
        context=context,
        lines=lines,
        delivery_mode=Order.DeliveryMode.COORDINATED,
        payment_method=Order.PaymentMethod.CASH,
        idempotency_key="duplicate-lines",
    )
    replay = create_order(
        context=context,
        lines=lines,
        delivery_mode=Order.DeliveryMode.COORDINATED,
        payment_method=Order.PaymentMethod.CASH,
        idempotency_key="duplicate-lines",
    )

    assert replay.replayed
    assert replay.order.pk == first.order.pk
    assert list(
        OrderItem.objects.filter(order=first.order).values_list(
            "quantity",
            "unit_sale_price",
            "unit_cost_snapshot",
        )
    ) == [(1, 1200, 700), (2, 1000, 700)]
    assert StockBalance.objects.get(product=product).reserved == 3
    assert StockReservation.objects.filter(order=first.order).count() == 2
    assert Order.objects.filter(organisation=context.organisation).count() == 1


@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="La concurrencia real se verifica sobre PostgreSQL.",
)
def test_concurrent_orders_cannot_both_reserve_last_unit() -> None:
    _user, context = identity("sales-race@example.com")
    product = create_product(
        context=context,
        name="Última unidad",
        initial_quantity=1,
    ).product
    barrier = threading.Barrier(2)
    errors: list[str] = []

    def reserve(index: int) -> None:
        try:
            barrier.wait(timeout=10)
            create_order(
                context=context,
                lines=[
                    {
                        "productId": str(product.public_id),
                        "quantity": 1,
                        "unitSalePrice": "5000",
                    }
                ],
                delivery_mode=Order.DeliveryMode.PICKUP,
                payment_method=Order.PaymentMethod.CASH,
                idempotency_key=f"race-{index}",
            )
        except DomainError as exc:
            errors.append(exc.code)
        finally:
            connections.close_all()

    threads = [threading.Thread(target=reserve, args=(index,)) for index in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=20)

    assert StockBalance.objects.get(product=product).reserved == 1
    assert Order.objects.filter(organisation=context.organisation).count() == 1
    assert errors == ["INSUFFICIENT_STOCK"]


def test_manual_confirmation_consumes_once_even_with_new_idempotency_key() -> None:
    _user, context = identity("sales-manual@example.com")
    order, product = order_for(
        context,
        product_name="Cuaderno",
        quantity=2,
        requested=2,
        price="2500",
    )
    paid_at = timezone.now()

    first = confirm_manual_payment(
        context=context,
        order_id=order.public_id,
        amount="5000",
        paid_at=paid_at,
        note="Pago presencial",
        idempotency_key="manual-pay",
    )
    replay = confirm_manual_payment(
        context=context,
        order_id=order.public_id,
        amount="5000",
        paid_at=paid_at,
        note="Pago presencial",
        idempotency_key="manual-pay",
    )
    guarded = confirm_manual_payment(
        context=context,
        order_id=order.public_id,
        amount="5000",
        paid_at=paid_at,
        note="Pago presencial",
        idempotency_key="manual-pay-second-key",
    )

    assert first.order.status == replay.order.status == guarded.order.status == Order.Status.PAID
    assert replay.replayed
    balance = StockBalance.objects.get(product=product)
    assert balance.on_hand == balance.reserved == 0
    assert (
        StockMovement.objects.filter(
            product=product,
            movement_type=StockMovement.MovementType.EXIT,
            reference_public_id=str(order.public_id),
        ).count()
        == 1
    )
    assert StockReservation.objects.get(order=order).consumed_at is not None


def test_cancel_then_expire_releases_once_and_keeps_valid_terminal_state() -> None:
    _user, context = identity("sales-cancel@example.com")
    order, product = order_for(context, product_name="Agenda")
    order.reservation_expires_at = timezone.now() - timedelta(minutes=1)
    order.save(update_fields=("reservation_expires_at", "updated_at"))

    cancelled = cancel_order(
        context=context,
        order_id=order.public_id,
        reason="Comprador desistió",
        idempotency_key="cancel-order",
    )
    replay = cancel_order(
        context=context,
        order_id=order.public_id,
        reason="Comprador desistió",
        idempotency_key="cancel-order",
    )

    assert cancelled.order.status == replay.order.status == Order.Status.CANCELLED
    assert replay.replayed
    assert expire_order(order.pk) is False
    assert StockBalance.objects.get(product=product).reserved == 0
    reservation = StockReservation.objects.get(order=order)
    assert reservation.released_at is not None
    assert reservation.consumed_at is None


def test_restore_cancelled_order_reserves_again_and_reopens_the_link() -> None:
    _user, context = identity("sales-restore@example.com")
    order, product = order_for(context, product_name="Cuaderno")
    cancel_order(
        context=context,
        order_id=order.public_id,
        reason="Cancelé por error",
        idempotency_key="cancel-to-restore",
    )
    assert StockBalance.objects.get(product=product).reserved == 0

    restored = restore_order(
        context=context,
        order_id=order.public_id,
        idempotency_key="restore-order",
    )
    replay = restore_order(
        context=context,
        order_id=order.public_id,
        idempotency_key="restore-order",
    )

    assert restored.order.status == replay.order.status == Order.Status.RESERVED
    assert replay.replayed
    assert restored.order.cancelled_at is None
    assert restored.order.reservation_expires_at > timezone.now()
    assert StockBalance.objects.get(product=product).reserved == 1
    assert StockReservation.objects.filter(order=restored.order).count() == 1
    reservation = StockReservation.objects.get(order=restored.order)
    assert reservation.released_at is None
    assert reservation.consumed_at is None
    assert reservation.expires_at == restored.order.reservation_expires_at

    already_open = restore_order(
        context=context,
        order_id=order.public_id,
        idempotency_key="restore-already-open",
    )
    assert already_open.order.status == Order.Status.RESERVED


def test_restore_cancelled_order_requires_available_stock() -> None:
    _user, context = identity("sales-restore-stock@example.com")
    order, product = order_for(
        context,
        product_name="Única unidad",
        quantity=1,
        requested=1,
    )
    cancel_order(
        context=context,
        order_id=order.public_id,
        reason="Cancelé por error",
        idempotency_key="cancel-stock",
    )
    create_order(
        context=context,
        lines=[
            {
                "productId": str(product.public_id),
                "quantity": 1,
                "unitSalePrice": "1000",
            }
        ],
        delivery_mode=Order.DeliveryMode.PICKUP,
        payment_method=Order.PaymentMethod.CASH,
        idempotency_key="take-stock",
    )
    with pytest.raises(DomainError) as error:
        restore_order(
            context=context,
            order_id=order.public_id,
            idempotency_key="restore-no-stock",
        )
    assert error.value.code == "INSUFFICIENT_STOCK"
    assert Order.objects.get(pk=order.pk).status == Order.Status.CANCELLED


@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="La carrera real se verifica sobre PostgreSQL.",
)
def test_cancellation_and_expiration_race_has_one_terminal_release() -> None:
    _user, context = identity("sales-expiry-race@example.com")
    order, product = order_for(context, product_name="Reserva en carrera")
    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timedelta(seconds=1)
    )
    barrier = threading.Barrier(2)
    errors: list[str] = []

    def cancel() -> None:
        try:
            barrier.wait(timeout=10)
            cancel_order(
                context=context,
                order_id=order.public_id,
                reason="Carrera",
                idempotency_key="race-cancel",
            )
        except DomainError as exc:
            errors.append(exc.code)
        finally:
            connections.close_all()

    def expire() -> None:
        barrier.wait(timeout=10)
        expire_order(order.pk)
        connections.close_all()

    threads = [threading.Thread(target=cancel), threading.Thread(target=expire)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=20)

    order.refresh_from_db()
    reservation = StockReservation.objects.get(order=order)
    assert order.status in {Order.Status.CANCELLED, Order.Status.EXPIRED}
    assert reservation.released_at is not None
    assert reservation.consumed_at is None
    assert StockBalance.objects.get(product=product).reserved == 0
    assert errors in ([], ["ORDER_TRANSITION_NOT_ALLOWED"])


def test_token_is_not_stored_plain_and_due_lookup_returns_expired_safe_state() -> None:
    _user, context = identity("sales-token@example.com")
    order, product = order_for(context, product_name="Privado")
    token = decrypt_credential(order.public_token_ciphertext)

    assert token not in order.public_token_hash
    assert token not in order.public_token_ciphertext
    with pytest.raises(ResourceNotFound):
        public_order_for_token(f"{token}-wrong")

    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timedelta(seconds=1)
    )
    visible = public_order_for_token(token)

    assert visible.status == Order.Status.EXPIRED
    assert StockBalance.objects.get(product=product).reserved == 0
    assert OrderEvent.objects.filter(order=order, event_type="order.expired").count() == 1


def test_public_receipt_is_order_scoped_and_approval_consumes_once() -> None:
    fake_object_storage.clear()
    _user, context = identity("sales-proof@example.com")
    order, product = order_for(
        context,
        product_name="Lámpara",
        quantity=1,
        requested=1,
        price="9000",
        method=Order.PaymentMethod.BANK_TRANSFER,
    )
    token = decrypt_credential(order.public_token_ciphertext)
    set_buyer_details(
        token=token,
        details={"name": "Ana", "email": "ana@example.com"},
    )
    prepared = prepare_receipt_upload(
        token=token,
        original_name="comprobante.png",
        content_type="image/png",
        size=4,
    )
    accept_fake_receipt_upload(
        token=token,
        asset_id=prepared.asset.public_id,
        content=b"data",
        content_type="image/png",
    )

    _foreign_user, foreign = identity("sales-proof-foreign@example.com")
    foreign_order, _foreign_product = order_for(
        foreign,
        product_name="Ajeno",
        method=Order.PaymentMethod.BANK_TRANSFER,
    )
    foreign_token = decrypt_credential(foreign_order.public_token_ciphertext)
    with pytest.raises(ResourceNotFound):
        complete_receipt_upload(
            token=foreign_token,
            asset_id=prepared.asset.public_id,
        )

    proof = complete_receipt_upload(
        token=token,
        asset_id=prepared.asset.public_id,
    )
    order.refresh_from_db()
    assert proof.status == PaymentProof.Status.READY
    assert order.status == Order.Status.PURCHASE_VALIDATION
    assert StockBalance.objects.get(product=product).reserved == 1
    Order.objects.filter(pk=order.pk).update(
        reservation_expires_at=timezone.now() - timedelta(seconds=1)
    )
    assert expire_order(order.pk) is False

    approved = review_payment_proof(
        context=context,
        order_id=order.public_id,
        approved=True,
        rejection_reason="",
        idempotency_key="approve-proof",
    )
    replay = review_payment_proof(
        context=context,
        order_id=order.public_id,
        approved=True,
        rejection_reason="",
        idempotency_key="approve-proof",
    )
    assert approved.order.status == Order.Status.PAID
    assert replay.replayed
    assert StockBalance.objects.get(product=product).on_hand == 0
    assert (
        StockMovement.objects.filter(
            product=product,
            movement_type=StockMovement.MovementType.EXIT,
        ).count()
        == 1
    )


def test_rejected_proof_requires_reason_and_releases_once() -> None:
    fake_object_storage.clear()
    _user, context = identity("sales-proof-reject@example.com")
    order, product = order_for(
        context,
        product_name="Marco",
        method=Order.PaymentMethod.BANK_TRANSFER,
    )
    token = decrypt_credential(order.public_token_ciphertext)
    prepared = prepare_receipt_upload(
        token=token,
        original_name="proof.pdf",
        content_type="application/pdf",
        size=3,
    )
    accept_fake_receipt_upload(
        token=token,
        asset_id=prepared.asset.public_id,
        content=b"pdf",
        content_type="application/pdf",
    )
    complete_receipt_upload(token=token, asset_id=prepared.asset.public_id)

    with pytest.raises(DomainError) as missing:
        review_payment_proof(
            context=context,
            order_id=order.public_id,
            approved=False,
            rejection_reason="",
            idempotency_key="reject-missing",
        )
    assert missing.value.field_errors["rejectionReason"]

    rejected = review_payment_proof(
        context=context,
        order_id=order.public_id,
        approved=False,
        rejection_reason="Monto ilegible",
        idempotency_key="reject-proof",
    )
    assert rejected.order.status == Order.Status.CANCELLED
    assert StockBalance.objects.get(product=product).reserved == 0
    assert StockReservation.objects.get(order=order).released_at is not None
