"""Celery entry points for durable inventory jobs."""

from __future__ import annotations

import uuid

from celery import shared_task

from .bulk import analyse_import_job, process_export_job, process_import_job


@shared_task(name="apps.inventory.tasks.analyse_inventory_import")  # type: ignore[misc]
def analyse_inventory_import(public_id: str) -> str:
    return str(analyse_import_job(uuid.UUID(public_id)).public_id)


@shared_task(name="apps.inventory.tasks.process_inventory_import")  # type: ignore[misc]
def process_inventory_import(public_id: str) -> str:
    return str(process_import_job(uuid.UUID(public_id)).public_id)


@shared_task(name="apps.inventory.tasks.process_inventory_export")  # type: ignore[misc]
def process_inventory_export(public_id: str) -> str:
    return str(process_export_job(uuid.UUID(public_id)).public_id)
