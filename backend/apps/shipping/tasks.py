"""Celery entry points for shipping follow-up cadences."""

from __future__ import annotations

from celery import shared_task

from .cadences import process_due_follow_ups


@shared_task(name="apps.shipping.tasks.process_due_follow_ups")  # type: ignore[misc]
def process_shipping_follow_ups() -> int:
    return process_due_follow_ups()
