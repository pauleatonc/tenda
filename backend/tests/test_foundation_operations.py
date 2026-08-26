from __future__ import annotations

import json

import pytest
from django.core.exceptions import ValidationError
from django.test import Client, override_settings
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.audit.services import record_audit_event
from apps.configuration.models import FeatureFlag, OperationalParameter
from apps.configuration.services import feature_enabled, parameter_value
from apps.notifications.models import Notification, OutboxEvent
from apps.notifications.outbox import MAX_ATTEMPTS, process_outbox_event
from apps.organisations.services import create_organisation_for_owner
from apps.users.models import User
from apps.users.providers import fake_auth_delivery_provider

pytestmark = pytest.mark.django_db(transaction=True)


def test_registration_uses_encrypted_outbox_notification_and_audit() -> None:
    fake_auth_delivery_provider.clear()
    response = Client().post(
        "/api/v1/auth/register",
        data=json.dumps(
            {
                "email": "outbox@example.com",
                "password": "Correct-Horse-Battery-42",
                "fullName": "Outbox",
                "acceptedTerms": True,
            }
        ),
        content_type="application/json",
        HTTP_X_CORRELATION_ID="outbox-registration",
    )

    delivery = fake_auth_delivery_provider.deliveries()[-1]
    event = OutboxEvent.objects.get(event_type="auth.verify_email")
    notification = Notification.objects.get(outbox_event=event)

    assert response.status_code == 202
    assert event.status == OutboxEvent.Status.SUCCEEDED
    assert event.payload["tokenCiphertext"] != delivery.token
    assert delivery.token not in json.dumps(event.payload)
    assert notification.status == Notification.Status.SENT
    assert AuditEvent.objects.filter(
        action="identity.register",
        correlation_id="outbox-registration",
    ).exists()


def test_audit_is_append_only_and_redacts_sensitive_metadata() -> None:
    event = record_audit_event(
        action="test.sensitive",
        metadata={
            "password": "never-store",
            "nested": {"accessToken": "never-store-either", "safe": "visible"},
        },
    )

    assert event.metadata == {
        "password": "[REDACTED]",
        "nested": {"accessToken": "[REDACTED]", "safe": "visible"},
    }
    event.action = "changed"
    with pytest.raises(ValidationError):
        event.save()
    with pytest.raises(ValidationError):
        event.delete()


@override_settings(OUTBOX_EAGER=False)
def test_outbox_retries_then_moves_unknown_event_to_dead_letter() -> None:
    event = OutboxEvent.objects.create(event_type="unknown.event", payload={})

    for _attempt in range(MAX_ATTEMPTS):
        event.available_at = timezone.now()
        event.save(update_fields=("available_at", "updated_at"))
        process_outbox_event(event.pk)
        event.refresh_from_db()

    assert event.status == OutboxEvent.Status.DEAD
    assert event.attempts == MAX_ATTEMPTS
    assert AuditEvent.objects.filter(
        action="outbox.dead_letter",
        object_public_id=str(event.public_id),
    ).exists()


def test_operational_configuration_prefers_tenant_override() -> None:
    user = User.objects.create_user(
        email="configuration@example.com",
        password="Correct-Horse-Battery-42",
    )
    organisation = create_organisation_for_owner(
        owner=user,
        name="Configuración",
    ).organisation
    OperationalParameter.objects.create(key="reservation_hours", value=8)
    OperationalParameter.objects.create(
        organisation=organisation,
        key="reservation_hours",
        value=4,
    )
    FeatureFlag.objects.create(key="new_dashboard", enabled=False)
    FeatureFlag.objects.create(
        organisation=organisation,
        key="new_dashboard",
        enabled=True,
    )

    assert parameter_value("reservation_hours", default=1) == 8
    assert (
        parameter_value(
            "reservation_hours",
            organisation=organisation,
            default=1,
        )
        == 4
    )
    assert feature_enabled("new_dashboard") is False
    assert feature_enabled("new_dashboard", organisation=organisation) is True
