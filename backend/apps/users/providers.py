"""Replaceable authentication providers with deterministic local fakes."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from threading import Lock
from typing import Protocol
from urllib.parse import quote, urlencode

import httpx
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

    def exchange(self, *, code: str, callback_url: str) -> OIDCIdentity: ...


class FakeGoogleOIDCProvider:
    """Deterministic provider used when credentials are intentionally absent."""

    expected_code = "tenda-fake-google"

    def authorization_url(self, *, state: str, callback_url: str) -> str:
        return f"{callback_url}?{urlencode({'state': state, 'code': self.expected_code})}"

    def exchange(self, *, code: str, callback_url: str) -> OIDCIdentity:
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


class GoogleOIDCProvider:
    authorization_endpoint = "https://accounts.google.com/o/oauth2/v2/auth"
    token_endpoint = "https://oauth2.googleapis.com/token"
    userinfo_endpoint = "https://openidconnect.googleapis.com/v1/userinfo"

    def authorization_url(self, *, state: str, callback_url: str) -> str:
        client_id = str(getattr(settings, "GOOGLE_OIDC_CLIENT_ID", "")).strip()
        if not client_id:
            raise DomainError(
                "PROVIDER_UNAVAILABLE",
                "Google no está configurado en este ambiente.",
                status=503,
            )
        query = urlencode(
            {
                "client_id": client_id,
                "redirect_uri": callback_url,
                "response_type": "code",
                "scope": "openid email profile",
                "state": state,
                "access_type": "online",
                "prompt": "select_account",
            }
        )
        return f"{self.authorization_endpoint}?{query}"

    def exchange(self, *, code: str, callback_url: str) -> OIDCIdentity:
        client_id = str(getattr(settings, "GOOGLE_OIDC_CLIENT_ID", "")).strip()
        client_secret = str(getattr(settings, "GOOGLE_OIDC_CLIENT_SECRET", "")).strip()
        if not client_id or not client_secret or not code.strip():
            raise DomainError(
                "OIDC_INVALID_RESPONSE",
                "No fue posible completar el acceso con Google.",
                status=400,
            )
        try:
            token_response = httpx.post(
                self.token_endpoint,
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": callback_url,
                    "grant_type": "authorization_code",
                },
                headers={"Accept": "application/json"},
                timeout=8,
            )
            token_response.raise_for_status()
            token_payload = token_response.json()
            access_token = token_payload["access_token"]
            userinfo_response = httpx.get(
                self.userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=8,
            )
            userinfo_response.raise_for_status()
            profile = userinfo_response.json()
            subject = str(profile["sub"])
            email = str(profile["email"])
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            raise DomainError(
                "OIDC_INVALID_RESPONSE",
                "No fue posible completar el acceso con Google.",
                status=400,
            ) from exc
        if not subject or not email:
            raise DomainError(
                "OIDC_INVALID_RESPONSE",
                "No fue posible completar el acceso con Google.",
                status=400,
            )
        verified = profile.get("email_verified")
        return OIDCIdentity(
            subject=subject,
            email=email,
            email_verified=verified is True or verified == "true",
            full_name=str(profile.get("name") or ""),
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
    mode = str(getattr(settings, "GOOGLE_OIDC_PROVIDER", "fake")).strip().lower()
    if mode == "fake":
        return FakeGoogleOIDCProvider()
    if mode in {"google", "real"}:
        return GoogleOIDCProvider()
    raise DomainError(
        "PROVIDER_UNAVAILABLE",
        "Google no está configurado en este ambiente.",
        status=503,
    )
