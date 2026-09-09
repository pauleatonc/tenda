from __future__ import annotations

from datetime import timedelta
from urllib.parse import urlparse

import pytest
from django.utils import timezone

from apps.sales.models import Order
from apps.shipping.labels import INTERNAL_LABEL_DISCLAIMER, INTERNAL_LABEL_TITLE
from apps.shipping.models import LabelDocument, Shipment
from tests.test_shipping_operations import graphql, paid_order, signed_in

pytestmark = pytest.mark.django_db(transaction=True)

GENERATE = """
mutation Generate($id: ID!, $key: String!) {
  generateShipmentLabel(shipmentId: $id, idempotencyKey: $key) {
    replayed
    label { id downloadUrl expiresAt createdAt fileName }
    shipment {
      id
      allowedActions
      latestLabel { id downloadUrl expiresAt }
      timeline { eventType title isPublic }
    }
  }
}
"""


def _download_bytes(client, url: str) -> bytes:
    path = urlparse(url).path
    response = client.get(path)
    assert response.status_code == 200, response.content
    return response.content


def test_generate_label_renders_internal_pdf_with_expiring_url() -> None:
    client, context = signed_in("label-ok@example.com")
    order = paid_order(context)
    shipment_id = str(order.shipment.public_id)

    first = graphql(client, GENERATE, id=shipment_id, key="label-1")
    replay = graphql(client, GENERATE, id=shipment_id, key="label-1")
    assert "errors" not in first, first.get("errors")
    payload = first["data"]["generateShipmentLabel"]
    assert payload["replayed"] is False
    assert replay["data"]["generateShipmentLabel"]["replayed"] is True
    assert replay["data"]["generateShipmentLabel"]["label"]["id"] == payload["label"]["id"]
    assert LabelDocument.objects.filter(shipment=order.shipment).count() == 1

    label = payload["label"]
    assert label["fileName"].startswith("etiqueta-interna-")
    assert "/api/v1/media/" in label["downloadUrl"]
    assert label["downloadUrl"].endswith("/content")
    assert "r2.invalid" not in label["downloadUrl"]
    assert label["expiresAt"]
    pdf = _download_bytes(client, label["downloadUrl"])
    assert pdf.startswith(b"%PDF")
    assert INTERNAL_LABEL_TITLE.encode("latin-1") in pdf
    assert INTERNAL_LABEL_DISCLAIMER.encode("latin-1") in pdf
    assert order.number.encode("latin-1") in pdf
    assert "generateShipmentLabel" in payload["shipment"]["allowedActions"]
    internal = [
        item
        for item in payload["shipment"]["timeline"]
        if item["eventType"] == "shipment.label_generated"
    ]
    assert internal
    assert internal[0]["isPublic"] is False
    assert payload["shipment"]["latestLabel"]["id"] == label["id"]


def test_generate_label_rejects_unpaid_and_incomplete_data() -> None:
    client, context = signed_in("label-guard@example.com")
    order = paid_order(context)
    shipment_id = str(order.shipment.public_id)

    Order.objects.filter(pk=order.pk).update(status=Order.Status.RESERVED, paid_at=None)
    unpaid = graphql(client, GENERATE, id=shipment_id, key="unpaid")
    assert unpaid["errors"][0]["extensions"]["code"] == "ORDER_NOT_PAID"
    assert LabelDocument.objects.filter(shipment_id=order.shipment.pk).count() == 0

    Order.objects.filter(pk=order.pk).update(status=Order.Status.PAID, paid_at=timezone.now())
    Shipment.objects.filter(pk=order.shipment.pk).update(
        recipient_name="",
        address_line="",
        city="",
    )
    incomplete = graphql(client, GENERATE, id=shipment_id, key="incomplete")
    assert incomplete["errors"][0]["extensions"]["code"] == "VALIDATION_ERROR"
    fields = incomplete["errors"][0]["extensions"]["fieldErrors"]
    assert "recipientName" in fields
    assert "addressLine" in fields
    assert "city" in fields


def test_label_download_expires_and_stays_tenant_safe() -> None:
    client_a, context_a = signed_in("label-a@example.com")
    client_b, _context_b = signed_in("label-b@example.com")
    order = paid_order(context_a)
    shipment_id = str(order.shipment.public_id)

    created = graphql(client_a, GENERATE, id=shipment_id, key="keep")
    assert "errors" not in created, created.get("errors")
    LabelDocument.objects.filter(shipment=order.shipment).update(
        expires_at=timezone.now() - timedelta(seconds=1)
    )
    expired = graphql(
        client_a,
        """
        query ($id: ID!) {
          shipment(id: $id) { latestLabel { id downloadUrl expiresAt } }
        }
        """,
        id=shipment_id,
    )
    assert expired["data"]["shipment"]["latestLabel"]["downloadUrl"] is None

    hidden = graphql(client_b, GENERATE, id=shipment_id, key="foreign")
    assert hidden["errors"][0]["extensions"]["code"] == "NOT_FOUND"
    assert LabelDocument.objects.filter(shipment=order.shipment).count() == 1
