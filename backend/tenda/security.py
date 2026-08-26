"""Application security headers not covered by Django's SecurityMiddleware."""

from __future__ import annotations

from collections.abc import Callable

from django.conf import settings
from django.http import HttpRequest, HttpResponse


class SecurityHeadersMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        script_sources = ["'self'", "https://challenges.cloudflare.com"]
        style_sources = ["'self'"]
        if settings.DEBUG and request.path == "/graphql/":
            script_sources.extend(["'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"])
            style_sources.extend(["'unsafe-inline'", "https://cdn.jsdelivr.net"])
        response.setdefault(
            "Content-Security-Policy",
            "; ".join(
                (
                    "default-src 'self'",
                    f"script-src {' '.join(script_sources)}",
                    f"style-src {' '.join(style_sources)}",
                    "img-src 'self' data: blob:",
                    "font-src 'self' data:",
                    "connect-src 'self' https://api.brevo.com https://api.mercadopago.com",
                    "frame-src https://challenges.cloudflare.com",
                    "object-src 'none'",
                    "base-uri 'self'",
                    "form-action 'self'",
                    "frame-ancestors 'none'",
                )
            ),
        )
        response.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=()",
        )
        response.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        return response
