"""Append-only audit commands with metadata minimisation."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from apps.audit.models import AuditEvent
from apps.organisations.models import Organisation
from apps.users.models import User

_SENSITIVE_PARTS = ("password", "token", "secret", "authorization", "cookie")


def _safe_metadata(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {
            str(key): (
                "[REDACTED]"
                if any(part in str(key).lower() for part in _SENSITIVE_PARTS)
                else _safe_metadata(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_safe_metadata(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def record_audit_event(
    *,
    action: str,
    organisation: Organisation | None = None,
    actor: User | None = None,
    object_type: str = "",
    object_public_id: str = "",
    outcome: str = AuditEvent.Outcome.SUCCESS,
    correlation_id: str = "",
    metadata: Mapping[str, Any] | None = None,
) -> AuditEvent:
    return AuditEvent.objects.create(
        organisation=organisation,
        actor=actor,
        action=action,
        object_type=object_type,
        object_public_id=object_public_id,
        outcome=outcome,
        correlation_id=correlation_id[:100],
        metadata=_safe_metadata(metadata or {}),
    )
