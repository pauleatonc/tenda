"""Exactly-once command wrapper scoped to one organisation."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any

from django.db import transaction

from apps.audit.models import IdempotencyKey
from apps.organisations.selectors import TenantContext
from tenda.errors import DomainError


@dataclass(frozen=True, slots=True)
class IdempotentResult:
    payload: dict[str, Any]
    status: int
    replayed: bool


def request_digest(payload: Mapping[str, Any]) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@transaction.atomic
def execute_idempotent(
    *,
    context: TenantContext,
    scope: str,
    key: str,
    request_payload: Mapping[str, Any],
    command: Callable[[], tuple[dict[str, Any], int]],
) -> IdempotentResult:
    clean_key = key.strip()
    if not clean_key or len(clean_key) > 128:
        raise DomainError(
            "IDEMPOTENCY_KEY_REQUIRED",
            "Esta acción requiere una clave de idempotencia válida.",
            field_errors={"idempotencyKey": ["Usa una clave de hasta 128 caracteres."]},
        )
    digest = request_digest(request_payload)
    existing = (
        IdempotencyKey.objects.select_for_update()
        .filter(
            organisation=context.organisation,
            scope=scope,
            key=clean_key,
        )
        .first()
    )
    if existing is not None:
        if existing.request_hash != digest:
            raise DomainError(
                "IDEMPOTENCY_KEY_REUSED",
                "La clave ya fue utilizada con datos diferentes.",
                status=409,
            )
        if existing.status == IdempotencyKey.Status.SUCCEEDED:
            return IdempotentResult(
                payload=dict(existing.response_payload or {}),
                status=existing.response_status,
                replayed=True,
            )
        raise DomainError(
            "IDEMPOTENCY_IN_PROGRESS",
            "La misma acción todavía está en proceso.",
            status=409,
            retryable=True,
        )

    record = IdempotencyKey.objects.create(
        organisation=context.organisation,
        actor=context.user,
        scope=scope,
        key=clean_key,
        request_hash=digest,
    )
    response_payload, response_status = command()
    record.response_payload = response_payload
    record.response_status = response_status
    record.status = IdempotencyKey.Status.SUCCEEDED
    record.save(
        update_fields=(
            "response_payload",
            "response_status",
            "status",
            "updated_at",
        )
    )
    return IdempotentResult(
        payload=response_payload,
        status=response_status,
        replayed=False,
    )
