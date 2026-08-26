"""Email provider boundary with deterministic fake and Brevo implementation."""

from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import Any, Protocol

import httpx
from django.conf import settings

from tenda.errors import DomainError


@dataclass(frozen=True, slots=True)
class EmailRequest:
    recipient: str
    template: str
    parameters: dict[str, Any]
    idempotency_key: str


@dataclass(frozen=True, slots=True)
class EmailResult:
    message_id: str


class EmailProvider(Protocol):
    def send(self, request: EmailRequest) -> EmailResult: ...


class FakeEmailProvider:
    def __init__(self) -> None:
        self._messages: list[EmailRequest] = []
        self._lock = Lock()

    def send(self, request: EmailRequest) -> EmailResult:
        with self._lock:
            if not any(
                message.idempotency_key == request.idempotency_key for message in self._messages
            ):
                self._messages.append(request)
        return EmailResult(message_id=f"fake-{request.idempotency_key}")

    def messages(self) -> tuple[EmailRequest, ...]:
        with self._lock:
            return tuple(self._messages)

    def clear(self) -> None:
        with self._lock:
            self._messages.clear()


class BrevoEmailProvider:
    endpoint = "https://api.brevo.com/v3/smtp/email"

    def send(self, request: EmailRequest) -> EmailResult:
        api_key = str(getattr(settings, "BREVO_API_KEY", ""))
        sender_email = str(getattr(settings, "BREVO_SENDER_EMAIL", ""))
        sender_name = str(getattr(settings, "BREVO_SENDER_NAME", "Tenda"))
        template_ids = dict(getattr(settings, "BREVO_TEMPLATE_IDS", {}))
        template_id = template_ids.get(request.template)
        if not api_key or not sender_email or template_id is None:
            raise DomainError(
                "EMAIL_NOT_CONFIGURED",
                "El proveedor de correo no está configurado.",
                status=503,
                retryable=True,
            )
        try:
            response = httpx.post(
                self.endpoint,
                headers={
                    "api-key": api_key,
                    "accept": "application/json",
                    "content-type": "application/json",
                    "idempotency-key": request.idempotency_key,
                },
                json={
                    "sender": {"name": sender_name, "email": sender_email},
                    "to": [{"email": request.recipient}],
                    "templateId": int(template_id),
                    "params": request.parameters,
                },
                timeout=5,
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise DomainError(
                "EMAIL_PROVIDER_UNAVAILABLE",
                "No se pudo enviar el correo.",
                status=503,
                retryable=True,
            ) from exc
        return EmailResult(message_id=str(payload.get("messageId", "")))


fake_email_provider = FakeEmailProvider()


def get_email_provider() -> EmailProvider:
    provider = str(getattr(settings, "EMAIL_PROVIDER", "fake"))
    if provider == "fake":
        return fake_email_provider
    if provider == "brevo":
        return BrevoEmailProvider()
    raise DomainError(
        "EMAIL_NOT_CONFIGURED",
        "El proveedor de correo no es válido.",
        status=503,
    )
