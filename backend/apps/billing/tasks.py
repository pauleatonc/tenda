"""Celery entry points for billing webhook processing."""

from __future__ import annotations

from celery import shared_task

from .webhooks import process_billing_webhook_event


@shared_task(
    name="apps.billing.tasks.process_billing_webhook",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 5},
)  # type: ignore[misc]
def process_billing_webhook(event_id: int) -> bool:
    return process_billing_webhook_event(event_id)
