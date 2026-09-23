"""Celery entry points; domain behavior remains in the outbox service."""

from __future__ import annotations

from celery import shared_task

from .outbox import dispatch_ready_outbox


@shared_task(name="apps.notifications.tasks.dispatch_outbox")  # type: ignore[misc]
def dispatch_outbox() -> int:
    return dispatch_ready_outbox()
