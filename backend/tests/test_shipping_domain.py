from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.inventory.services import create_product
from apps.notifications.models import OutboxEvent
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.sales.models import Order
from apps.sales.order_services import confirm_manual_payment, create_order, set_buyer_details
from apps.shipping.models import Shipment
from apps.shipping.services import ensure_shipment_for_paid_order, register_shipment_dispatch
from apps.users.models import User
from tenda.crypto import decrypt_credential
from tenda.errors import DomainError

pytestmark = pytest.mark.django_db(transaction=True)


def identity(email: str) -> tuple[User, TenantContext]:
    user = User.objects.create_user(
        email=email,
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    return user, resolve_tenant_context(user)


def reserved_order(
    context: TenantContext,
    *,
    delivery_mode: str = Order.DeliveryMode.SHIPPING,
) -> Order:
    product = create_product(
        context=context,
        name="Velón",
        purchase_price="400",
        sale_price="1000",
        initial_quantity=3,
    ).product
    return create_order(
        context=context,
        lines=[
            {
                "productId": str(product.public_id),
                "quantity": 2,
                "unitSalePrice": "1000",
            }
        ],
        delivery_mode=delivery_mode,
        payment_method=Order.PaymentMethod.CASH,
        idempotency_key=f"create-{product.public_id}",
    ).order


def paid_order(
    context: TenantContext,
    *,
    delivery_mode: str = Order.DeliveryMode.SHIPPING,
    email: str = "camila@example.cl",
) -> Order:
    order = reserved_order(context, delivery_mode=delivery_mode)
    token = decrypt_credential(order.public_token_ciphertext)
    details = {
        "name": "Camila Soto",
        "email": email,
        "phone": "+56911111111",
        "recipientName": "Camila Soto",
        "recipientTaxId": "11.111.111-1",
        "addressLine": "Los Aromos 123",
        "commune": "Ñuñoa",
        "region": "Región Metropolitana de Santiago",
    }
    set_buyer_details(token=token, details=details, correlation_id="buyer")
    confirm_manual_payment(
        context=context,
        order_id=order.public_id,
        amount="2000",
        paid_at=timezone.now(),
        note="Pago en efectivo",
        idempotency_key=f"pay-{order.public_id}",
        correlation_id="pay",
    )
    order.refresh_from_db()
    return order


def _notifications(shipment: Shipment) -> list[OutboxEvent]:
    return list(
        OutboxEvent.objects.filter(
            aggregate_public_id=str(shipment.public_id),
            event_type="shipping.shipment_notification",
        )
    )


def test_unpaid_order_cannot_create_shipment() -> None:
    _user, context = identity("ship-unpaid@example.com")
    order = reserved_order(context)

    with pytest.raises(DomainError) as exc:
        ensure_shipment_for_paid_order(order, correlation_id="no")

    assert exc.value.code == "ORDER_NOT_PAID"
    assert Shipment.objects.filter(order=order).count() == 0


def test_paid_order_creates_one_shipment_with_label_and_replays() -> None:
    _user, context = identity("ship-paid@example.com")
    order = paid_order(context)

    first = ensure_shipment_for_paid_order(order, correlation_id="again")
    second = ensure_shipment_for_paid_order(order, correlation_id="again")

    assert first.replayed is True
    assert second.replayed is True
    assert Shipment.objects.filter(order=order).count() == 1
    assert first.shipment.status == Shipment.Status.PENDING
    assert first.shipment.labels.count() == 1
    assert _notifications(first.shipment) == []


def test_buyer_snapshot_edits_do_not_change_shipment_address() -> None:
    _user, context = identity("ship-snapshot@example.com")
    order = paid_order(context)
    shipment = order.shipment
    original = (shipment.address_line, shipment.commune, shipment.region)

    buyer = order.buyer
    buyer.address_line = "Nueva 999"
    buyer.commune = "Providencia"
    buyer.region = "Otra"
    buyer.save(update_fields=("address_line", "commune", "region", "updated_at"))
    shipment.refresh_from_db()

    assert (shipment.address_line, shipment.commune, shipment.region) == original
    with pytest.raises(ValidationError):
        shipment.address_line = "Nueva 999"
        shipment.save()


def test_register_dispatch_sets_terminal_status_and_emails_buyer_once() -> None:
    _user, context = identity("ship-dispatch@example.com")
    order = paid_order(context)
    shipment = order.shipment
    payload = {
        "carrier": "Chilexpress",
        "tracking_code": "CX-99",
        "tracking_url": "https://chilexpress.cl/track/CX-99",
        "note": "Sale hoy en la tarde",
    }

    first = register_shipment_dispatch(
        context=context,
        shipment_id=shipment.public_id,
        payload=payload,
        idempotency_key="dispatch-1",
    )
    replay = register_shipment_dispatch(
        context=context,
        shipment_id=shipment.public_id,
        payload=payload,
        idempotency_key="dispatch-1",
    )

    assert first.replayed is False
    assert replay.replayed is True
    registered = first.shipment
    assert registered.status == Shipment.Status.DISPATCHED
    assert registered.dispatched_at is not None
    assert registered.delivered_at is None
    assert registered.carrier == "Chilexpress"
    assert registered.tracking_code == "CX-99"
    assert registered.dispatch_note == "Sale hoy en la tarde"

    events = _notifications(registered)
    assert len(events) == 1
    payload_sent = events[0].payload
    assert payload_sent["recipient"] == "camila@example.cl"
    assert payload_sent["template"] == "shipment.dispatched"
    parameters = payload_sent["parameters"]
    assert parameters["orderNumber"] == order.number
    assert parameters["carrier"] == "Chilexpress"
    assert parameters["trackingCode"] == "CX-99"
    assert parameters["actionUrl"] == "https://chilexpress.cl/track/CX-99"
    assert parameters["note"] == "Sale hoy en la tarde"
    assert parameters["addressLine"] == "Los Aromos 123"
    assert parameters["items"] == [
        {
            "productName": "Velón",
            "quantity": 2,
            "unitSalePrice": "1000",
            "lineTotal": "2000",
        }
    ]
    assert parameters["total"] == str(order.total_amount)


def test_register_dispatch_requires_carrier_for_shipping_orders() -> None:
    _user, context = identity("ship-carrier@example.com")
    order = paid_order(context)

    with pytest.raises(DomainError) as exc:
        register_shipment_dispatch(
            context=context,
            shipment_id=order.shipment.public_id,
            payload={"tracking_code": "CX-1"},
            idempotency_key="no-carrier",
        )

    assert exc.value.code == "VALIDATION_ERROR"
    assert "carrier" in exc.value.field_errors
    order.shipment.refresh_from_db()
    assert order.shipment.status == Shipment.Status.PENDING
    assert _notifications(order.shipment) == []


def test_pickup_order_registers_delivery_without_carrier() -> None:
    _user, context = identity("ship-pickup@example.com")
    order = paid_order(context, delivery_mode=Order.DeliveryMode.PICKUP)

    result = register_shipment_dispatch(
        context=context,
        shipment_id=order.shipment.public_id,
        payload={"carrier": "Ignorado", "note": "Retirado en tienda"},
        idempotency_key="pickup-1",
    )

    shipment = result.shipment
    assert shipment.status == Shipment.Status.DELIVERED
    assert shipment.delivered_at is not None
    assert shipment.dispatched_at is None
    assert shipment.carrier == ""
    events = _notifications(shipment)
    assert len(events) == 1
    assert events[0].payload["template"] == "shipment.delivered"
    assert events[0].payload["parameters"]["note"] == "Retirado en tienda"


def test_register_dispatch_is_terminal() -> None:
    _user, context = identity("ship-terminal@example.com")
    order = paid_order(context)
    register_shipment_dispatch(
        context=context,
        shipment_id=order.shipment.public_id,
        payload={"carrier": "Starken"},
        idempotency_key="first",
    )

    with pytest.raises(DomainError) as exc:
        register_shipment_dispatch(
            context=context,
            shipment_id=order.shipment.public_id,
            payload={"carrier": "Chilexpress"},
            idempotency_key="second",
        )

    assert exc.value.code == "SHIPMENT_ALREADY_REGISTERED"
    order.shipment.refresh_from_db()
    assert order.shipment.carrier == "Starken"
    assert len(_notifications(order.shipment)) == 1


def test_register_dispatch_without_buyer_email_skips_notification() -> None:
    _user, context = identity("ship-noemail@example.com")
    order = paid_order(context, email="")

    result = register_shipment_dispatch(
        context=context,
        shipment_id=order.shipment.public_id,
        payload={"carrier": "Blue Express"},
        idempotency_key="silent",
    )

    assert result.shipment.status == Shipment.Status.DISPATCHED
    assert _notifications(result.shipment) == []


def test_unpaid_order_cannot_be_dispatched() -> None:
    _user, context = identity("ship-unpaid-dispatch@example.com")
    order = paid_order(context)
    order.status = Order.Status.RESERVED
    order.paid_at = None
    order.save(update_fields=("status", "paid_at", "updated_at"))

    with pytest.raises(DomainError) as exc:
        register_shipment_dispatch(
            context=context,
            shipment_id=order.shipment.public_id,
            payload={"carrier": "Chilexpress"},
            idempotency_key="dispatch",
        )
    assert exc.value.code == "ORDER_NOT_PAID"
