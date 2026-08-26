from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.inventory.models import Product, StockBalance, StockMovement
from apps.inventory.services import create_product, update_product
from apps.organisations.models import Membership
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.sales.models import (
    Order,
    OrderEvent,
    Payment,
    PaymentWebhookEvent,
    ReconciliationIssue,
    SellerPaymentConnection,
)
from apps.sales.order_services import (
    apply_provider_snapshot,
    cancel_order,
    confirm_manual_payment,
    create_order,
    initiate_mercado_pago_checkout,
    refund_payment,
    set_buyer_details,
)
from apps.sales.payments import MercadoPagoProvider, PaymentSnapshot, fake_payment_provider
from apps.sales.selectors import (
    BalanceFilter,
    sales_balance,
    sales_balance_breakdown,
    sales_dashboard,
)
from apps.sales.webhooks import process_payment_webhook_event, retry_reconciliation
from apps.users.models import User
from tenda.crypto import decrypt_credential, encrypt_credential
from tenda.errors import DomainError

pytestmark = pytest.mark.django_db(transaction=True)


def identity(
    email: str,
    *,
    role: str = Membership.Role.OWNER,
) -> tuple[User, TenantContext]:
    user = User.objects.create_user(
        email=email,
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    provision = create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    if role != Membership.Role.OWNER:
        provision.membership.role = role
        provision.membership.view_financials = False
        provision.membership.save(update_fields=("role", "view_financials"))
    return user, resolve_tenant_context(user)


def connected(context: TenantContext) -> SellerPaymentConnection:
    return SellerPaymentConnection.objects.create(
        organisation=context.organisation,
        status=SellerPaymentConnection.Status.CONNECTED,
        provider_account_id=f"seller-{context.organisation.public_id}",
        access_token_ciphertext=encrypt_credential("seller-access-token"),
        connected_at=timezone.now(),
    )


def create_sale(
    context: TenantContext,
    *,
    name: str,
    price: str,
    cost: str | None,
    quantity: int = 1,
    method: str = Order.PaymentMethod.CASH,
) -> tuple[Order, Product]:
    product = create_product(
        context=context,
        name=name,
        sale_price=price,
        purchase_price=cost,
        initial_quantity=quantity,
    ).product
    order = create_order(
        context=context,
        lines=[
            {
                "productId": str(product.public_id),
                "quantity": quantity,
                "unitSalePrice": price,
            }
        ],
        delivery_mode=Order.DeliveryMode.PICKUP,
        payment_method=method,
        idempotency_key=f"create-{name}",
    ).order
    return order, product


def test_balance_uses_line_snapshots_refunds_and_financial_permission() -> None:
    _owner, context = identity("balance-owner@example.com")
    first, product = create_sale(
        context,
        name="Producto con costo",
        price="1000",
        cost="400",
        quantity=2,
    )
    confirm_manual_payment(
        context=context,
        order_id=first.public_id,
        amount="2000",
        paid_at=timezone.now(),
        note="",
        idempotency_key="pay-first",
    )
    second, _without_cost = create_sale(
        context,
        name="Producto sin costo",
        price="500",
        cost=None,
        quantity=2,
    )
    confirm_manual_payment(
        context=context,
        order_id=second.public_id,
        amount="1000",
        paid_at=timezone.now(),
        note="",
        idempotency_key="pay-second",
    )
    refund_payment(
        context=context,
        order_id=second.public_id,
        reason="Devolución total",
        idempotency_key="refund-second",
    )
    update_product(
        context=context,
        product_id=product.public_id,
        purchase_price="9999",
        sale_price="99999",
    )
    create_sale(
        context,
        name="Pendiente",
        price="300",
        cost="100",
        quantity=1,
    )

    balance = sales_balance(context, filters=BalanceFilter())
    page = sales_balance_breakdown(
        context,
        filters=BalanceFilter(),
        first=1,
    )

    assert balance.confirmed_gross == Decimal("3000")
    assert balance.refunds == Decimal("1000")
    assert balance.net_sales == Decimal("2000")
    assert balance.known_cogs == Decimal("800")
    assert balance.gross_margin == Decimal("1200")
    assert balance.pending_amount == Decimal("300")
    assert balance.operations == 2
    assert balance.recognized_lines == 2
    assert balance.known_cost_lines == 1
    assert balance.cost_coverage == Decimal("50")
    assert balance.cost_incomplete
    assert page.total_count == 2
    assert page.has_next_page
    assert page.end_cursor

    _operator, operator_context = identity(
        "balance-operator@example.com",
        role=Membership.Role.OPERATOR,
    )
    with pytest.raises(DomainError) as denied:
        sales_balance(operator_context, filters=BalanceFilter())
    assert denied.value.code == "PERMISSION_DENIED"


def test_balance_date_cut_uses_business_timezone_and_product_filter() -> None:
    _owner, context = identity("balance-timezone@example.com")
    order, product = create_sale(
        context,
        name="Corte local",
        price="1200",
        cost="200",
    )
    confirm_manual_payment(
        context=context,
        order_id=order.public_id,
        amount="1200",
        paid_at=datetime(2026, 8, 26, 2, 30, tzinfo=UTC),
        note="",
        idempotency_key="timezone-payment",
    )
    _foreign_owner, foreign = identity("balance-timezone-foreign@example.com")
    foreign_order, _foreign_product = create_sale(
        foreign,
        name="No mezclar",
        price="9000",
        cost="1",
    )
    confirm_manual_payment(
        context=foreign,
        order_id=foreign_order.public_id,
        amount="9000",
        paid_at=datetime(2026, 8, 26, 2, 30, tzinfo=UTC),
        note="",
        idempotency_key="foreign-payment",
    )

    local_day = sales_balance(
        context,
        filters=BalanceFilter(
            date_from=date(2026, 8, 25),
            date_to=date(2026, 8, 25),
            product_id=product.public_id,
        ),
    )
    next_day = sales_balance(
        context,
        filters=BalanceFilter(
            date_from=date(2026, 8, 26),
            date_to=date(2026, 8, 26),
        ),
    )

    assert local_day.confirmed_gross == Decimal("1200")
    assert local_day.operations == 1
    assert next_day.confirmed_gross == Decimal("0")


def _mp_order(
    context: TenantContext,
    *,
    name: str,
    amount: str,
) -> tuple[Order, Product, Payment, SellerPaymentConnection]:
    connection = SellerPaymentConnection.objects.filter(
        organisation=context.organisation
    ).first() or connected(context)
    order, product = create_sale(
        context,
        name=name,
        price=amount,
        cost="100",
        method=Order.PaymentMethod.MERCADO_PAGO,
    )
    token = decrypt_credential(order.public_token_ciphertext)
    set_buyer_details(
        token=token,
        details={"name": "Comprador", "email": "buyer@example.com"},
    )
    checkout = initiate_mercado_pago_checkout(
        token=token,
        idempotency_key=f"checkout-{name}",
    )
    return checkout.order, product, checkout.payment, connection


def _webhook(
    *,
    resource_id: str,
    provider_account_id: str = "",
    event_id: str | None = None,
) -> PaymentWebhookEvent:
    return PaymentWebhookEvent.objects.create(
        provider="mercado_pago",
        provider_event_id=event_id or f"event-{resource_id}",
        event_type="payment",
        raw_body="{}",
        normalized_payload={"providerAccountId": provider_account_id},
        provider_resource_id=resource_id,
        signature_valid=True,
    )


def test_webhook_provider_truth_is_idempotent_and_out_of_order_safe() -> None:
    fake_payment_provider.clear_payments()
    _owner, context = identity("webhook-approved@example.com")
    order, product, payment, connection = _mp_order(
        context,
        name="Pago aprobado",
        amount="1500",
    )
    snapshot = PaymentSnapshot(
        provider_payment_id="mp-approved",
        status="approved",
        status_detail="accredited",
        external_reference=f"order:{order.public_id}",
        amount=Decimal("1500"),
        currency="CLP",
        fee_amount=Decimal("0"),
        net_received=Decimal("1500"),
        approved_at=timezone.now(),
    )
    fake_payment_provider.set_payment(snapshot)
    event = _webhook(
        resource_id="mp-approved",
        provider_account_id=connection.provider_account_id,
    )

    assert process_payment_webhook_event(event.pk)
    assert process_payment_webhook_event(event.pk) is False
    order.refresh_from_db()
    payment.refresh_from_db()
    assert order.status == Order.Status.PAID
    assert payment.status == Payment.Status.APPROVED
    assert payment.provider_payment_id == "mp-approved"
    assert StockBalance.objects.get(product=product).on_hand == 0
    assert (
        StockMovement.objects.filter(
            product=product,
            movement_type=StockMovement.MovementType.EXIT,
        ).count()
        == 1
    )

    fake_payment_provider.set_payment(
        PaymentSnapshot(
            provider_payment_id="mp-approved",
            status="pending",
            status_detail="pending_waiting_payment",
            external_reference=f"order:{order.public_id}",
            amount=Decimal("1500"),
            currency="CLP",
            fee_amount=Decimal("0"),
        )
    )
    later_event = _webhook(
        resource_id="mp-approved",
        provider_account_id=connection.provider_account_id,
        event_id="later-pending-event",
    )
    assert process_payment_webhook_event(later_event.pk)
    order.refresh_from_db()
    payment.refresh_from_db()
    assert order.status == Order.Status.PAID
    assert payment.status == Payment.Status.APPROVED
    assert (
        StockMovement.objects.filter(
            product=product,
            movement_type=StockMovement.MovementType.EXIT,
        ).count()
        == 1
    )


def test_webhook_mismatch_stays_reserved_and_creates_visible_issue() -> None:
    fake_payment_provider.clear_payments()
    _owner, context = identity("webhook-mismatch@example.com")
    order, product, payment, connection = _mp_order(
        context,
        name="Pago distinto",
        amount="2000",
    )
    fake_payment_provider.set_payment(
        PaymentSnapshot(
            provider_payment_id="mp-mismatch",
            status="approved",
            status_detail="accredited",
            external_reference=f"order:{order.public_id}",
            amount=Decimal("1999"),
            currency="CLP",
            fee_amount=Decimal("0"),
        )
    )
    event = _webhook(
        resource_id="mp-mismatch",
        provider_account_id=connection.provider_account_id,
    )

    assert process_payment_webhook_event(event.pk)
    order.refresh_from_db()
    payment.refresh_from_db()
    assert order.status == Order.Status.PURCHASE_IN_PROGRESS
    assert order.reconciliation_status == Order.ReconciliationStatus.REQUIRED
    assert payment.status == Payment.Status.RECONCILIATION_REQUIRED
    assert StockBalance.objects.get(product=product).reserved == 1
    assert ReconciliationIssue.objects.filter(
        order=order,
        kind=ReconciliationIssue.Kind.PAYMENT_MISMATCH,
    ).exists()


def test_paid_without_active_reservation_is_durable_and_duplicate_safe() -> None:
    fake_payment_provider.clear_payments()
    _owner, context = identity("webhook-stock-reconciliation@example.com")
    order, product, payment, connection = _mp_order(
        context,
        name="Pago sin reserva",
        amount="1800",
    )
    order.reservations.update(released_at=timezone.now(), release_reason="Inconsistencia")
    fake_payment_provider.set_payment(
        PaymentSnapshot(
            provider_payment_id="mp-without-reservation",
            status="approved",
            status_detail="accredited",
            external_reference=f"order:{order.public_id}",
            amount=Decimal("1800"),
            currency="CLP",
            fee_amount=Decimal("0"),
        )
    )
    event = _webhook(
        resource_id="mp-without-reservation",
        provider_account_id=connection.provider_account_id,
    )

    assert process_payment_webhook_event(event.pk)
    order.refresh_from_db()
    payment.refresh_from_db()
    event.refresh_from_db()
    assert event.status == PaymentWebhookEvent.Status.PROCESSED
    assert order.status == Order.Status.PURCHASE_IN_PROGRESS
    assert order.reconciliation_status == Order.ReconciliationStatus.REQUIRED
    assert payment.status == Payment.Status.RECONCILIATION_REQUIRED
    assert StockBalance.objects.get(product=product).on_hand == 1
    assert not StockMovement.objects.filter(
        product=product,
        movement_type=StockMovement.MovementType.EXIT,
    ).exists()
    assert (
        ReconciliationIssue.objects.filter(
            order=order,
            webhook_event=event,
            kind=ReconciliationIssue.Kind.PAID_WITHOUT_STOCK,
        ).count()
        == 1
    )
    assert OrderEvent.objects.filter(
        order=order,
        event_type="reconciliation.required",
    ).exists()

    PaymentWebhookEvent.objects.filter(pk=event.pk).update(
        status=PaymentWebhookEvent.Status.RECEIVED,
    )
    assert process_payment_webhook_event(event.pk)
    assert (
        ReconciliationIssue.objects.filter(
            order=order,
            webhook_event=event,
            kind=ReconciliationIssue.Kind.PAID_WITHOUT_STOCK,
        ).count()
        == 1
    )


def test_webhook_apply_failure_retries_instead_of_staying_processing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fake_payment_provider.clear_payments()
    _owner, context = identity("webhook-retry@example.com")
    order, _product, _payment, connection = _mp_order(
        context,
        name="Webhook reintentable",
        amount="1300",
    )
    fake_payment_provider.set_payment(
        PaymentSnapshot(
            provider_payment_id="mp-retry",
            status="approved",
            status_detail="accredited",
            external_reference=f"order:{order.public_id}",
            amount=Decimal("1300"),
            currency="CLP",
            fee_amount=Decimal("0"),
        )
    )
    event = _webhook(
        resource_id="mp-retry",
        provider_account_id=connection.provider_account_id,
    )

    def fail_apply(**_kwargs: object) -> None:
        raise RuntimeError("simulated apply failure")

    monkeypatch.setattr("apps.sales.webhooks.apply_provider_snapshot", fail_apply)
    assert process_payment_webhook_event(event.pk) is False
    event.refresh_from_db()
    assert event.status == PaymentWebhookEvent.Status.FAILED
    assert event.next_retry_at is not None
    assert ReconciliationIssue.objects.filter(
        webhook_event=event,
        kind=ReconciliationIssue.Kind.WEBHOOK_PENDING,
        status=ReconciliationIssue.Status.OPEN,
    ).exists()

    monkeypatch.setattr("apps.sales.webhooks.apply_provider_snapshot", apply_provider_snapshot)
    PaymentWebhookEvent.objects.filter(pk=event.pk).update(
        next_retry_at=timezone.now() - timedelta(seconds=1),
    )
    assert retry_reconciliation() == 1
    event.refresh_from_db()
    order.refresh_from_db()
    assert event.status == PaymentWebhookEvent.Status.PROCESSED
    assert order.status == Order.Status.PAID
    assert ReconciliationIssue.objects.filter(
        webhook_event=event,
        kind=ReconciliationIssue.Kind.WEBHOOK_PENDING,
        status=ReconciliationIssue.Status.RESOLVED,
    ).exists()


def test_missing_provider_payment_id_keeps_refund_issue_after_error() -> None:
    fake_payment_provider.clear_payments()
    _owner, context = identity("refund-reconciliation@example.com")
    order, _product, payment, connection = _mp_order(
        context,
        name="Reembolso sin referencia",
        amount="2200",
    )
    fake_payment_provider.set_payment(
        PaymentSnapshot(
            provider_payment_id="mp-refund-reference",
            status="approved",
            status_detail="accredited",
            external_reference=f"order:{order.public_id}",
            amount=Decimal("2200"),
            currency="CLP",
            fee_amount=Decimal("0"),
        )
    )
    event = _webhook(
        resource_id="mp-refund-reference",
        provider_account_id=connection.provider_account_id,
    )
    assert process_payment_webhook_event(event.pk)
    Payment.objects.filter(pk=payment.pk).update(provider_payment_id="")

    with pytest.raises(DomainError) as failure:
        refund_payment(
            context=context,
            order_id=order.public_id,
            reason="Proveedor sin referencia",
            idempotency_key="refund-without-provider-id",
        )

    assert failure.value.code == "PAYMENT_RECONCILIATION_REQUIRED"
    order.refresh_from_db()
    payment.refresh_from_db()
    assert order.status == Order.Status.PAID
    assert order.reconciliation_status == Order.ReconciliationStatus.REQUIRED
    assert payment.status == Payment.Status.RECONCILIATION_REQUIRED
    assert ReconciliationIssue.objects.filter(
        order=order,
        payment=payment,
        kind=ReconciliationIssue.Kind.UNKNOWN_PAYMENT,
    ).exists()


def test_mercado_pago_fee_snapshot_excludes_provider_processing_charge(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Response:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "id": "mp-fee",
                "status": "approved",
                "status_detail": "accredited",
                "external_reference": "order:00000000-0000-0000-0000-000000000001",
                "transaction_amount": 1000,
                "currency_id": "CLP",
                "fee_details": [
                    {"type": "mercadopago_fee", "amount": 50},
                    {"type": "application_fee", "amount": 0},
                ],
                "transaction_details": {"net_received_amount": 950},
                "transaction_amount_refunded": 0,
            }

    monkeypatch.setattr("apps.sales.payments.httpx.get", lambda *args, **kwargs: Response())

    snapshot = MercadoPagoProvider().payment("mp-fee", access_token="seller-token")

    assert snapshot.fee_amount == Decimal("0")
    assert snapshot.net_received == Decimal("950")


def test_rejected_provider_payment_releases_and_unknown_payment_is_durable() -> None:
    fake_payment_provider.clear_payments()
    _owner, context = identity("webhook-rejected@example.com")
    order, product, _payment, connection = _mp_order(
        context,
        name="Pago rechazado",
        amount="700",
    )
    fake_payment_provider.set_payment(
        PaymentSnapshot(
            provider_payment_id="mp-rejected",
            status="rejected",
            status_detail="cc_rejected_other_reason",
            external_reference=f"order:{order.public_id}",
            amount=Decimal("700"),
            currency="CLP",
            fee_amount=Decimal("0"),
        )
    )
    event = _webhook(
        resource_id="mp-rejected",
        provider_account_id=connection.provider_account_id,
    )
    assert process_payment_webhook_event(event.pk)
    order.refresh_from_db()
    assert order.status == Order.Status.CANCELLED
    assert StockBalance.objects.get(product=product).reserved == 0

    fake_payment_provider.set_payment(
        PaymentSnapshot(
            provider_payment_id="mp-unknown",
            status="approved",
            status_detail="accredited",
            external_reference="order:not-a-uuid",
            amount=Decimal("1"),
            currency="CLP",
        )
    )
    unknown = _webhook(
        resource_id="mp-unknown",
        provider_account_id=connection.provider_account_id,
        event_id="unknown-event",
    )
    assert process_payment_webhook_event(unknown.pk)
    unknown_issue = ReconciliationIssue.objects.get(
        webhook_event=unknown,
        kind=ReconciliationIssue.Kind.UNKNOWN_PAYMENT,
    )
    assert unknown_issue.organisation == context.organisation
    assert sales_dashboard(context).reconciliation_required == 1


def test_provider_approval_after_cancellation_creates_reconciliation_issue() -> None:
    fake_payment_provider.clear_payments()
    _owner, context = identity("webhook-late-approval@example.com")
    order, product, payment, connection = _mp_order(
        context,
        name="Aprobación tardía",
        amount="900",
    )
    cancel_order(
        context=context,
        order_id=order.public_id,
        reason="Cancelación previa",
        idempotency_key="cancel-before-provider-approval",
    )
    fake_payment_provider.set_payment(
        PaymentSnapshot(
            provider_payment_id="mp-late-approval",
            status="approved",
            status_detail="accredited",
            external_reference=f"order:{order.public_id}",
            amount=Decimal("900"),
            currency="CLP",
            fee_amount=Decimal("0"),
        )
    )
    event = _webhook(
        resource_id="mp-late-approval",
        provider_account_id=connection.provider_account_id,
    )

    assert process_payment_webhook_event(event.pk)
    order.refresh_from_db()
    payment.refresh_from_db()
    assert order.status == Order.Status.CANCELLED
    assert order.reconciliation_status == Order.ReconciliationStatus.REQUIRED
    assert payment.status == Payment.Status.RECONCILIATION_REQUIRED
    assert StockBalance.objects.get(product=product).on_hand == 1
    assert StockBalance.objects.get(product=product).reserved == 0
    assert ReconciliationIssue.objects.filter(
        order=order,
        webhook_event=event,
        kind=ReconciliationIssue.Kind.PAID_WITHOUT_STOCK,
    ).exists()
