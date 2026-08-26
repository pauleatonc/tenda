"""Celery entry points for sales expiry, webhook processing and reconciliation."""

from __future__ import annotations

from celery import shared_task

from .order_services import expire_due_orders
from .webhooks import process_payment_webhook_event, retry_reconciliation


@shared_task(name="apps.sales.tasks.expire_orders")  # type: ignore[misc]
def expire_orders() -> int:
    return expire_due_orders()


@shared_task(
    name="apps.sales.tasks.process_payment_webhook",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_kwargs={"max_retries": 5},
)  # type: ignore[misc]
def process_payment_webhook(event_id: int) -> bool:
    return process_payment_webhook_event(event_id)


@shared_task(name="apps.sales.tasks.retry_reconciliation")  # type: ignore[misc]
def reconcile_payments() -> int:
    return retry_reconciliation()
