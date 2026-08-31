"""Cloudflare Turnstile adapter with an explicit local fake."""

from __future__ import annotations

import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings

from tenda.errors import DomainError

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def require_turnstile(*, token: str, remote_ip: str) -> None:
    """Skip the challenge in local fake mode; verify with Cloudflare otherwise."""
    if bool(getattr(settings, "TURNSTILE_FAKE_MODE", False)):
        return
    if not token.strip():
        raise DomainError(
            "ANTIBOT_FAILED",
            "No pudimos validar el formulario. Recarga la página e inténtalo nuevamente.",
            status=400,
        )
    verify_turnstile(token=token, remote_ip=remote_ip)


def verify_turnstile(*, token: str, remote_ip: str) -> None:
    secret = str(getattr(settings, "TURNSTILE_SECRET_KEY", ""))
    if not secret:
        if bool(getattr(settings, "TURNSTILE_FAKE_MODE", False)) and token == "local-development":
            return
        raise DomainError(
            "ANTIBOT_UNAVAILABLE",
            "No pudimos validar el formulario. Inténtalo nuevamente.",
            status=503,
            retryable=True,
        )

    request = Request(  # noqa: S310 - host is a fixed trusted provider
        TURNSTILE_VERIFY_URL,
        data=urlencode(
            {
                "secret": secret,
                "response": token,
                "remoteip": remote_ip,
            }
        ).encode(),
        method="POST",
    )
    try:
        with urlopen(request, timeout=4) as response:  # noqa: S310
            payload = json.loads(response.read())
    except (OSError, ValueError) as exc:
        raise DomainError(
            "ANTIBOT_UNAVAILABLE",
            "No pudimos validar el formulario. Inténtalo nuevamente.",
            status=503,
            retryable=True,
        ) from exc
    if not payload.get("success"):
        raise DomainError(
            "ANTIBOT_FAILED",
            "No pudimos validar el formulario. Recarga la página e inténtalo nuevamente.",
            status=400,
        )
