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
from apps.shipping.models import Shipment, ShipmentEvent
from apps.shipping.services import ensure_shipment_for_paid_order, transition_shipment
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


def reserved_order(context: TenantContext) -> Order:
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
                "quantity": 1,
                "unitSalePrice": "1000",
            }
        ],
        delivery_mode=Order.DeliveryMode.SHIPPING,
        payment_method=Order.PaymentMethod.CASH,
        idempotency_key=f"create-{product.public_id}",
    ).order


def paid_order(context: TenantContext) -> Order:
    order = reserved_order(context)
    token = decrypt_credential(order.public_token_ciphertext)
    set_buyer_details(
        token=token,
        details={
            "name": "Camila Soto",
            "email": "camila@example.cl",
            "phone": "+56911111111",
            "recipientName": "Camila Soto",
            "recipientTaxId": "11.111.111-1",
            "addressLine": "Los Aromos 123",
            "commune": "Ñuñoa",
            "region": "Región Metropolitana de Santiago",
        },
        correlation_id="buyer",
    )
    confirm_manual_payment(
        context=context,
        order_id=order.public_id,
        amount="1000",
        paid_at=timezone.now(),
        note="Pago en efectivo",
        idempotency_key=f"pay-{order.public_id}",
        correlation_id="pay",
    )
    order.refresh_from_db()
    return order


def test_unpaid_order_cannot_create_shipment() -> None:
    _user, context = identity("ship-unpaid@example.com")
    order = reserved_order(context)

    with pytest.raises(DomainError) as exc:
        ensure_shipment_for_paid_order(order, correlation_id="no")

    assert exc.value.code == "ORDER_NOT_PAID"
    assert Shipment.objects.filter(order=order).count() == 0


def test_paid_order_creates_one_shipment_and_replays() -> None:
    _user, context = identity("ship-paid@example.com")
    order = paid_order(context)

    first = ensure_shipment_for_paid_order(order, correlation_id="again")
    second = ensure_shipment_for_paid_order(order, correlation_id="again")

    assert first.replayed is True
    assert second.replayed is True
    assert Shipment.objects.filter(order=order).count() == 1
    assert first.shipment.status == Shipment.Status.PENDING
    assert (
        ShipmentEvent.objects.filter(
            shipment=first.shipment,
            event_type="shipment.created",
        ).count()
        == 1
    )
    assert first.shipment.labels.count() == 1


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


def test_repeated_transition_does_not_duplicate_event_or_notification() -> None:
    user, context = identity("ship-transition@example.com")
    order = paid_order(context)
    shipment = order.shipment

    first = transition_shipment(
        context,
        shipment_id=shipment.public_id,
        target=Shipment.Status.PREPARING,
        comment="Armando el pedido",
        actor=user,
        correlation_id="prep",
    )
    second = transition_shipment(
        context,
        shipment_id=shipment.public_id,
        target=Shipment.Status.PREPARING,
        comment="Armando el pedido",
        actor=user,
        correlation_id="prep",
    )

    assert first.replayed is False
    assert second.replayed is True
    events = list(ShipmentEvent.objects.filter(shipment=shipment).order_by("created_at"))
    assert [event.event_type for event in events] == [
        "shipment.created",
        "shipment.label_generated",
        "shipment.preparing",
    ]
    assert (
        OutboxEvent.objects.filter(
            aggregate_public_id=str(shipment.public_id),
            event_type="shipping.shipment_notification",
        ).count()
        == 1
    )


def test_unpaid_order_cannot_be_dispatched() -> None:
    user, context = identity("ship-dispatch@example.com")
    order = paid_order(context)
    shipment = order.shipment
    transition_shipment(
        context,
        shipment_id=shipment.public_id,
        target=Shipment.Status.PREPARING,
        actor=user,
        correlation_id="prep",
    )
    order.status = Order.Status.RESERVED
    order.paid_at = None
    order.save(update_fields=("status", "paid_at", "updated_at"))

    with pytest.raises(DomainError) as exc:
        transition_shipment(
            context,
            shipment_id=shipment.public_id,
            target=Shipment.Status.DISPATCHED,
            actor=user,
            correlation_id="dispatch",
        )
    assert exc.value.code == "ORDER_NOT_PAID"
