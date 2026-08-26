"""Structured, correlation-aware telemetry with conservative redaction."""

from __future__ import annotations

import json
import logging
import re
from contextvars import ContextVar, Token
from datetime import UTC, datetime
from typing import Any, cast

from sentry_sdk.types import Event

_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="")
_EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_BEARER = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+")
_SECRET_QUERY = re.compile(
    r"(?i)(token|password|secret|code|authorization)=((?:Bearer\s+)?[^&\s]+)"
)
_SENSITIVE_KEYS = {
    "authorization",
    "cookie",
    "email",
    "password",
    "secret",
    "token",
}


def bind_correlation_id(value: str) -> Token[str]:
    return _correlation_id.set(value)


def reset_correlation_id(token: Token[str]) -> None:
    _correlation_id.reset(token)


def current_correlation_id() -> str:
    return _correlation_id.get()


def redact_text(value: str) -> str:
    value = _SECRET_QUERY.sub(lambda match: f"{match.group(1)}=[REDACTED]", value)
    value = _EMAIL.sub("[EMAIL]", value)
    value = _BEARER.sub("Bearer [REDACTED]", value)
    return value


def _redact_mapping(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            str(key): (
                "[REDACTED]"
                if any(part in str(key).lower() for part in _SENSITIVE_KEYS)
                else _redact_mapping(item)
            )
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_mapping(item) for item in value]
    if isinstance(value, str):
        return redact_text(value)
    return value


class RedactingJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_text(record.getMessage()),
            "correlationId": getattr(
                record,
                "correlation_id",
                current_correlation_id(),
            ),
        }
        for key in ("event", "outbox_event_id", "event_type", "attempt"):
            if hasattr(record, key):
                payload[key] = _redact_mapping(getattr(record, key))
        if record.exc_info and record.exc_info[0] is not None:
            payload["exception"] = {"type": record.exc_info[0].__name__}
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def scrub_sentry_event(
    event: Event,
    _hint: dict[str, Any],
) -> Event:
    scrubbed = _redact_mapping(event)
    if isinstance(scrubbed, dict):
        scrubbed.setdefault("tags", {})["correlation_id"] = current_correlation_id()
        return cast(Event, scrubbed)
    return event
