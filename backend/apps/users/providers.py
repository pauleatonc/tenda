"""Replaceable authentication providers with deterministic local fakes."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from threading import Lock
from typing import Protocol
from urllib.parse import quote, urlencode

from django.conf import settings

from apps.notifications.providers import EmailRequest, get_email_provider
from tenda.errors import DomainError


@dataclass(frozen=True, slots=True)
class AuthDelivery:
    kind: str
    recipient: str
    token: str
    expires_at: datetime


class AuthDeliveryProvider(Protocol):
    def send(self, delivery: AuthDelivery) -> None: ...


class FakeAuthDeliveryProvider:
    """Process-local test sink; it never writes raw tokens to logs or the database."""

    def __init__(self) -> None:
        self._deliveries: list[AuthDelivery] = []
        self._lock = Lock()

    def send(self, delivery: AuthDelivery) -> None:
        with self._lock:
            self._deliveries.append(delivery)
            del self._deliveries[:-100]

    def deliveries(self) -> tuple[AuthDelivery, ...]:
        with self._lock:
            return tuple(self._deliveries)

    def clear(self) -> None:
        with self._lock:
            self._deliveries.clear()


fake_auth_delivery_provider = FakeAuthDeliveryProvider()


class ConfiguredAuthDeliveryProvider:
    def send(self, delivery: AuthDelivery) -> None:
        path = "/verificar-email" if delivery.kind == "verify_email" else "/recuperar"
        action_url = f"{settings.WEB_ORIGIN}{path}?token={quote(delivery.token, safe='')}"
        get_email_provider().send(
            EmailRequest(
                recipient=delivery.recipient,
                template=delivery.kind,
                parameters={
                    "actionUrl": action_url,
                    "expiresAt": delivery.expires_at.isoformat(),
                },
                idempotency_key=(
                    f"{delivery.kind}:{hashlib.sha256(delivery.token.encode()).hexdigest()}"
                ),
            )
        )


def get_auth_delivery_provider() -> AuthDeliveryProvider:
    if str(getattr(settings, "EMAIL_PROVIDER", "fake")) == "fake":
        return fake_auth_delivery_provider
    return ConfiguredAuthDeliveryProvider()


@dataclass(frozen=True, slots=True)
class OIDCIdentity:
    subject: str
    email: str
    email_verified: bool
    full_name: str


class OIDCProvider(Protocol):
    def authorization_url(self, *, state: str, callback_url: str) -> str: ...

    def exchange(self, *, code: str) -> OIDCIdentity: ...


class FakeGoogleOIDCProvider:
    """Deterministic provider used when credentials are intentionally absent."""

    expected_code = "tenda-fake-google"

    def authorization_url(self, *, state: str, callback_url: str) -> str:
        return f"{callback_url}?{urlencode({'state': state, 'code': self.expected_code})}"

    def exchange(self, *, code: str) -> OIDCIdentity:
        if code != self.expected_code:
            raise DomainError(
                "OIDC_INVALID_RESPONSE",
                "No fue posible completar el acceso con Google.",
                status=400,
            )
        return OIDCIdentity(
            subject="fake-google-subject-001",
            email="google.user@example.test",
            email_verified=True,
            full_name="Usuario Google",
        )


def get_oidc_provider(provider: str) -> OIDCProvider:
    if provider == "linkedin":
        if not bool(getattr(settings, "LINKEDIN_OIDC_ENABLED", False)):
            raise DomainError(
                "PROVIDER_UNAVAILABLE",
                "Este método de acceso no está disponible.",
                status=404,
            )
        raise DomainError(
            "PROVIDER_UNAVAILABLE",
            "Este método de acceso no está disponible.",
            status=503,
        )
    if provider != "google":
        raise DomainError(
            "PROVIDER_UNAVAILABLE",
            "Este método de acceso no está disponible.",
            status=404,
        )
    if str(getattr(settings, "GOOGLE_OIDC_PROVIDER", "fake")) != "fake":
        raise DomainError(
            "PROVIDER_UNAVAILABLE",
            "Google no está configurado en este ambiente.",
            status=503,
        )
    return FakeGoogleOIDCProvider()
