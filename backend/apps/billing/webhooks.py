"""Durable processing of Mercado Pago billing webhooks."""

from __future__ import annotations

from django.utils import timezone

from .models import BillingWebhookEvent
from .services import sync_subscription_from_provider


def process_billing_webhook_event(event_id: int) -> bool:
    event = BillingWebhookEvent.objects.filter(pk=event_id).first()
    if event is None:
        return False
    if event.status == BillingWebhookEvent.Status.PROCESSED:
        return True
    if not event.signature_valid:
        event.status = BillingWebhookEvent.Status.IGNORED
        event.last_error = "INVALID_WEBHOOK_SIGNATURE"
        event.save(update_fields=("status", "last_error", "updated_at"))
        return False

    event.status = BillingWebhookEvent.Status.PROCESSING
    event.attempts += 1
    event.save(update_fields=("status", "attempts", "updated_at"))

    topic = event.event_type.lower()
    if topic not in {
        "subscription_preapproval",
        "subscription_authorized_payment",
        "subscription_preapproval_plan",
        "preapproval",
        "authorized_payment",
    }:
        event.status = BillingWebhookEvent.Status.IGNORED
        event.last_error = "UNSUPPORTED_TOPIC"
        event.processed_at = timezone.now()
        event.save(update_fields=("status", "last_error", "processed_at", "updated_at"))
        return True

    try:
        subscription = sync_subscription_from_provider(event.provider_resource_id)
        if subscription is not None:
            event.organisation = subscription.organisation
        event.status = BillingWebhookEvent.Status.PROCESSED
        event.last_error = ""
        event.processed_at = timezone.now()
        event.save(
            update_fields=(
                "organisation",
                "status",
                "last_error",
                "processed_at",
                "updated_at",
            )
        )
        return True
    except Exception as exc:  # noqa: BLE001 — durable inbox captures failure
        event.status = BillingWebhookEvent.Status.FAILED
        event.last_error = str(exc)[:240]
        event.save(update_fields=("status", "last_error", "updated_at"))
        raise
