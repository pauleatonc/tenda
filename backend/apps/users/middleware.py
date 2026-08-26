"""Request authentication, correlation and validated tenant context."""

from __future__ import annotations

import re
import uuid
from collections.abc import Callable
from datetime import timedelta

from django.contrib.auth import logout
from django.contrib.auth.models import AnonymousUser
from django.http import HttpRequest, HttpResponse
from django.utils import timezone

from apps.organisations.selectors import TenantContext, resolve_tenant_context
from tenda.errors import DomainError
from tenda.observability import bind_correlation_id, reset_correlation_id

from .models import MobileSession, User
from .services import mobile_session_from_token

_CORRELATION_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,100}$")


def get_correlation_id(request: HttpRequest) -> str:
    return str(getattr(request, "correlation_id", ""))


def get_mobile_session(request: HttpRequest) -> MobileSession | None:
    value = getattr(request, "mobile_session", None)
    return value if isinstance(value, MobileSession) else None


def get_tenant_context(request: HttpRequest) -> TenantContext | None:
    value = getattr(request, "tenant_context", None)
    return value if isinstance(value, TenantContext) else None


def persist_tenant_context(request: HttpRequest, context: TenantContext) -> None:
    mobile_session = get_mobile_session(request)
    if mobile_session is not None:
        mobile_session.active_organisation = context.organisation
        mobile_session.active_inventory = context.inventory
        mobile_session.save(
            update_fields=("active_organisation", "active_inventory"),
        )
    else:
        request.session["active_organisation_id"] = str(context.organisation.public_id)
        request.session["active_inventory_id"] = str(context.inventory.public_id)
    setattr(request, "tenant_context", context)  # noqa: B010


class CorrelationIdMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        supplied = request.headers.get("X-Correlation-ID", "")
        correlation_id = supplied if _CORRELATION_PATTERN.fullmatch(supplied) else str(uuid.uuid4())
        setattr(request, "correlation_id", correlation_id)  # noqa: B010
        token = bind_correlation_id(correlation_id)
        try:
            response = self.get_response(request)
            response["X-Correlation-ID"] = correlation_id
            return response
        finally:
            reset_correlation_id(token)


class MobileJsonCsrfBypassMiddleware:
    """Allow native JSON requests while browser cookie requests keep CSRF checks.

    A cross-origin HTML form cannot set this custom header or JSON content type.
    Fetch requests remain constrained by the configured CORS origins.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if (
            request.headers.get("X-Tenda-Client") == "mobile"
            and request.content_type == "application/json"
        ):
            setattr(request, "_dont_enforce_csrf_checks", True)  # noqa: B010
        return self.get_response(request)


class BearerAuthenticationMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        setattr(request, "mobile_session", None)  # noqa: B010
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            mobile_session = mobile_session_from_token(authorization[7:].strip())
            if mobile_session is None:
                request.user = AnonymousUser()
            else:
                request.user = mobile_session.user
                setattr(request, "mobile_session", mobile_session)  # noqa: B010
                if (
                    mobile_session.last_seen_at is None
                    or mobile_session.last_seen_at < timezone.now() - timedelta(minutes=5)
                ):
                    mobile_session.last_seen_at = timezone.now()
                    mobile_session.save(update_fields=("last_seen_at",))
        elif isinstance(request.user, User) and request.user.is_authenticated:
            expected_version = request.session.get("auth_session_version")
            if expected_version is None:
                request.session["auth_session_version"] = request.user.session_version
            elif expected_version != request.user.session_version:
                logout(request)
        return self.get_response(request)


class TenantContextMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        setattr(request, "tenant_context", None)  # noqa: B010
        if isinstance(request.user, User) and request.user.is_authenticated:
            mobile_session = get_mobile_session(request)
            organisation_id: uuid.UUID | None = None
            inventory_id: uuid.UUID | None = None
            if mobile_session is not None:
                if mobile_session.active_organisation is not None:
                    organisation_id = mobile_session.active_organisation.public_id
                if mobile_session.active_inventory is not None:
                    inventory_id = mobile_session.active_inventory.public_id
            else:
                try:
                    raw_organisation = request.session.get("active_organisation_id")
                    raw_inventory = request.session.get("active_inventory_id")
                    organisation_id = uuid.UUID(raw_organisation) if raw_organisation else None
                    inventory_id = uuid.UUID(raw_inventory) if raw_inventory else None
                except (TypeError, ValueError):
                    organisation_id = None
                    inventory_id = None
            try:
                context = resolve_tenant_context(
                    request.user,
                    organisation_id=organisation_id,
                    inventory_id=inventory_id,
                )
            except DomainError:
                context = None
            if context is not None:
                persist_tenant_context(request, context)
        return self.get_response(request)
