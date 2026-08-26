"""Transactional outbox dispatcher with bounded retries and dead letters."""

from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record_audit_event
from apps.organisations.models import Organisation
from tenda.crypto import decrypt_outbox_value
from tenda.errors import DomainError

from .models import Notification, NotificationDelivery, OutboxEvent
from .providers import EmailRequest, get_email_provider

logger = logging.getLogger(__name__)
MAX_ATTEMPTS = 5


@transaction.atomic
def enqueue_outbox_event(
    *,
    event_type: str,
    payload: Mapping[str, Any],
    organisation: Organisation | None = None,
    aggregate_type: str = "",
    aggregate_public_id: str = "",
    deduplication_key: str | None = None,
) -> OutboxEvent:
    if deduplication_key:
        event, _created = OutboxEvent.objects.get_or_create(
            deduplication_key=deduplication_key,
            defaults={
                "organisation": organisation,
                "event_type": event_type,
                "aggregate_type": aggregate_type,
                "aggregate_public_id": aggregate_public_id,
                "payload": dict(payload),
            },
        )
    else:
        event = OutboxEvent.objects.create(
            organisation=organisation,
            event_type=event_type,
            aggregate_type=aggregate_type,
            aggregate_public_id=aggregate_public_id,
            payload=dict(payload),
        )
    if bool(getattr(settings, "OUTBOX_EAGER", False)):
        transaction.on_commit(lambda: process_outbox_event(event.pk))
    return event


def _auth_delivery(event: OutboxEvent) -> None:
    from apps.users.providers import AuthDelivery, get_auth_delivery_provider

    payload = event.payload
    recipient = str(payload["recipient"])
    template = str(payload["kind"])
    expires_at = datetime.fromisoformat(str(payload["expiresAt"]))
    raw_token = decrypt_outbox_value(str(payload["tokenCiphertext"]))
    notification, _created = Notification.objects.get_or_create(
        outbox_event=event,
        channel=Notification.Channel.EMAIL,
        defaults={
            "organisation": event.organisation,
            "template": template,
            "recipient": recipient,
            "context": {"expiresAt": expires_at.isoformat()},
        },
    )
    try:
        get_auth_delivery_provider().send(
            AuthDelivery(
                kind=template,
                recipient=recipient,
                token=raw_token,
                expires_at=expires_at,
            )
        )
    except Exception as exc:
        NotificationDelivery.objects.create(
            notification=notification,
            provider="auth-provider",
            status=NotificationDelivery.Status.FAILED,
            error_code=type(exc).__name__[:80],
        )
        notification.status = Notification.Status.FAILED
        notification.save(update_fields=("status", "updated_at"))
        raise
    NotificationDelivery.objects.create(
        notification=notification,
        provider="auth-provider",
        status=NotificationDelivery.Status.SENT,
    )
    notification.status = Notification.Status.SENT
    notification.sent_at = timezone.now()
    notification.save(update_fields=("status", "sent_at", "updated_at"))


def _sales_delivery(event: OutboxEvent) -> None:
    payload = event.payload
    recipient = str(payload["recipient"])
    template = str(payload["template"])
    parameters = dict(payload.get("parameters") or {})
    encrypted_link = str(payload.get("linkCiphertext") or "")
    if encrypted_link:
        link_parameter = str(payload.get("linkParameter") or "orderUrl")
        parameters[link_parameter] = decrypt_outbox_value(encrypted_link)
    notification, _created = Notification.objects.get_or_create(
        outbox_event=event,
        channel=Notification.Channel.EMAIL,
        defaults={
            "organisation": event.organisation,
            "template": template,
            "recipient": recipient,
            "context": dict(payload.get("parameters") or {}),
        },
    )
    try:
        result = get_email_provider().send(
            EmailRequest(
                recipient=recipient,
                template=template,
                parameters=parameters,
                idempotency_key=str(event.public_id),
            )
        )
    except Exception as exc:
        NotificationDelivery.objects.create(
            notification=notification,
            provider="email-provider",
            status=NotificationDelivery.Status.FAILED,
            error_code=type(exc).__name__[:80],
        )
        notification.status = Notification.Status.FAILED
        notification.save(update_fields=("status", "updated_at"))
        raise
    NotificationDelivery.objects.create(
        notification=notification,
        provider="email-provider",
        status=NotificationDelivery.Status.SENT,
        provider_message_id=result.message_id[:160],
    )
    notification.status = Notification.Status.SENT
    notification.sent_at = timezone.now()
    notification.save(update_fields=("status", "sent_at", "updated_at"))


def _dispatch(event: OutboxEvent) -> None:
    if event.event_type in {"auth.verify_email", "auth.reset_password"}:
        _auth_delivery(event)
        return
    if event.event_type in {
        "sales.order_notification",
        "shipping.shipment_notification",
        "shipping.ticket_notification",
    }:
        _sales_delivery(event)
        return
    raise DomainError(
        "OUTBOX_HANDLER_NOT_FOUND",
        f"No existe handler para {event.event_type}.",
        status=500,
    )


def process_outbox_event(event_id: int) -> bool:
    with transaction.atomic():
        event = OutboxEvent.objects.select_for_update().filter(pk=event_id).first()
        if event is None or event.status in {
            OutboxEvent.Status.SUCCEEDED,
            OutboxEvent.Status.DEAD,
        }:
            return False
        if event.available_at > timezone.now():
            return False
        event.status = OutboxEvent.Status.PROCESSING
        event.attempts += 1
        event.locked_at = timezone.now()
        event.save(update_fields=("status", "attempts", "locked_at", "updated_at"))

    try:
        _dispatch(event)
    except Exception as exc:
        with transaction.atomic():
            failed = OutboxEvent.objects.select_for_update().get(pk=event_id)
            failed.last_error = type(exc).__name__[:500]
            failed.locked_at = None
            if failed.attempts >= MAX_ATTEMPTS:
                failed.status = OutboxEvent.Status.DEAD
                record_audit_event(
                    organisation=failed.organisation,
                    action="outbox.dead_letter",
                    object_type="OutboxEvent",
                    object_public_id=str(failed.public_id),
                    outcome="failure",
                    metadata={"eventType": failed.event_type, "attempts": failed.attempts},
                )
            else:
                failed.status = OutboxEvent.Status.PENDING
                delay_seconds = min(3600, 2**failed.attempts * 15)
                failed.available_at = timezone.now() + timedelta(seconds=delay_seconds)
            failed.save(
                update_fields=(
                    "status",
                    "last_error",
                    "locked_at",
                    "available_at",
                    "updated_at",
                )
            )
        logger.warning(
            "Outbox delivery failed",
            extra={
                "outbox_event_id": str(event.public_id),
                "event_type": event.event_type,
                "attempt": event.attempts,
            },
        )
        return False

    OutboxEvent.objects.filter(pk=event_id).update(
        status=OutboxEvent.Status.SUCCEEDED,
        processed_at=timezone.now(),
        locked_at=None,
        last_error="",
    )
    return True


def dispatch_ready_outbox(*, limit: int = 50) -> int:
    event_ids = list(
        OutboxEvent.objects.filter(
            status=OutboxEvent.Status.PENDING,
            available_at__lte=timezone.now(),
        )
        .order_by("created_at")
        .values_list("pk", flat=True)[:limit]
    )
    return sum(process_outbox_event(event_id) for event_id in event_ids)
