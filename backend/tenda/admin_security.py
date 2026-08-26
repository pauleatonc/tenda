"""Network restriction and durable login throttling for Django Admin."""

from __future__ import annotations

import ipaddress
from collections.abc import Callable

from django.conf import settings
from django.http import HttpRequest, HttpResponse

from apps.users.services import clear_auth_rate_limit, enforce_auth_rate_limit
from tenda.errors import DomainError


def _client_ip(request: HttpRequest) -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    if settings.ADMIN_TRUST_X_FORWARDED_FOR and forwarded:
        return forwarded.rsplit(",", maxsplit=1)[-1].strip()[:64]
    return str(request.META.get("REMOTE_ADDR", ""))[:64]


def _network_allowed(address: str) -> bool:
    configured = settings.ADMIN_ALLOWED_NETWORKS
    if not configured:
        return True
    try:
        client = ipaddress.ip_address(address)
    except ValueError:
        return False
    for value in configured:
        try:
            if client in ipaddress.ip_network(value, strict=False):
                return True
        except ValueError:
            continue
    return False


class AdminSecurityMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if not request.path.startswith(f"/{settings.ADMIN_URL_PATH}"):
            return self.get_response(request)

        client_ip = _client_ip(request)
        if not _network_allowed(client_ip):
            return HttpResponse(status=404)

        identity = ""
        if request.method == "POST" and request.path.rstrip("/").endswith("/login"):
            identity = str(request.POST.get("username", ""))[:254]
            try:
                enforce_auth_rate_limit(
                    action="admin_login",
                    identity=identity,
                    ip_address=client_ip,
                )
            except DomainError:
                response = HttpResponse(
                    "Demasiados intentos. Inténtalo más tarde.",
                    status=429,
                    content_type="text/plain; charset=utf-8",
                )
                response["Retry-After"] = "900"
                return response

        response = self.get_response(request)
        response["Cache-Control"] = "no-store"
        if identity and request.user.is_authenticated and request.user.is_staff:
            clear_auth_rate_limit(
                action="admin_login",
                identity=identity,
                ip_address=client_ip,
            )
        return response
