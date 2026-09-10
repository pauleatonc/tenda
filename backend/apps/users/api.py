"""Versioned REST authentication adapters."""

from __future__ import annotations

import json
import uuid
from collections.abc import Callable
from functools import wraps
from typing import Any

from django.conf import settings
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.core.exceptions import RequestDataTooBig
from django.http import (
    HttpRequest,
    HttpResponse,
    HttpResponseRedirect,
    JsonResponse,
)
from django.middleware.csrf import get_token

from apps.audit.models import AuditEvent
from apps.audit.services import record_audit_event
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import asset_content_url
from apps.organisations.bank import has_complete_bank_details
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from tenda.antibot import require_turnstile
from tenda.errors import (
    AuthenticationRequired,
    DomainError,
    ResourceNotFound,
)

from .middleware import (
    get_correlation_id,
    get_mobile_session,
    get_tenant_context,
    persist_tenant_context,
)
from .models import OIDCLoginState, User
from .selectors import mobile_sessions_for_user, profile_for_user
from .services import (
    AuthenticatedIdentity,
    authenticate_password,
    begin_oidc,
    canonical_email,
    clear_auth_rate_limit,
    complete_oidc,
    confirm_password_reset,
    enforce_auth_rate_limit,
    issue_mobile_session,
    membership_summary,
    mobile_oidc_app_redirect,
    register,
    request_email_verification,
    request_password_reset,
    revoke_all_sessions,
    revoke_mobile_session,
    revoke_mobile_session_by_id,
    session_public_id,
    verify_email,
)

Endpoint = Callable[..., HttpResponse]


class MobileAppRedirect(HttpResponseRedirect):
    allowed_schemes = ["http", "https", "tenda", "exp"]


def success(payload: dict[str, object], *, status: int = 200) -> JsonResponse:
    return JsonResponse({"data": payload}, status=status)


def error_response(request: HttpRequest, error: DomainError) -> JsonResponse:
    return JsonResponse(
        {
            "error": {
                "code": error.code,
                "message": error.message,
                "fieldErrors": error.field_errors,
                "retryable": error.retryable,
                "correlationId": get_correlation_id(request),
            }
        },
        status=error.status,
    )


def endpoint(*methods: str) -> Callable[[Endpoint], Endpoint]:
    allowed = {method.upper() for method in methods}

    def decorator(view: Endpoint) -> Endpoint:
        @wraps(view)
        def wrapped(request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
            if request.method not in allowed:
                return error_response(
                    request,
                    DomainError(
                        "METHOD_NOT_ALLOWED",
                        "Método no permitido.",
                        status=405,
                    ),
                )
            try:
                return view(request, *args, **kwargs)
            except RequestDataTooBig:
                return error_response(
                    request,
                    DomainError(
                        "UPLOAD_TOO_LARGE",
                        "El archivo supera el tamaño máximo permitido.",
                    ),
                )
            except DomainError as exc:
                return error_response(request, exc)

        return wrapped

    return decorator


def csrf_failure(request: HttpRequest, reason: str = "") -> JsonResponse:
    del reason
    return error_response(
        request,
        DomainError(
            "CSRF_FAILED",
            "La sesión del formulario expiró. Recarga la página e inténtalo nuevamente.",
            status=403,
        ),
    )


def _body(request: HttpRequest) -> dict[str, Any]:
    try:
        payload = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise DomainError("INVALID_JSON", "El cuerpo JSON no es válido.") from exc
    if not isinstance(payload, dict):
        raise DomainError("INVALID_JSON", "El cuerpo JSON no es válido.")
    return payload


def _string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key, "")
    return value if isinstance(value, str) else ""


def _client_ip(request: HttpRequest) -> str:
    value = request.META.get("REMOTE_ADDR", "")
    return str(value)[:64]


def _is_mobile(request: HttpRequest) -> bool:
    return request.headers.get("X-Tenda-Client") == "mobile"


def _require_user(request: HttpRequest) -> User:
    if not isinstance(request.user, User) or not request.user.is_authenticated:
        raise AuthenticationRequired()
    return request.user


def _require_context(request: HttpRequest) -> TenantContext:
    _require_user(request)
    context = get_tenant_context(request)
    if context is None:
        raise ResourceNotFound()
    return context


def _asset_url(organisation_id: int, asset_id: object) -> str | None:
    if not asset_id:
        return None
    asset = MediaAsset.objects.filter(
        public_id=asset_id,
        organisation_id=organisation_id,
        status=MediaAsset.Status.READY,
    ).first()
    return asset_content_url(asset, variant="thumbnail")


def _context_payload(context: TenantContext) -> dict[str, object]:
    organisation = context.organisation
    return {
        "organisation": {
            "id": str(organisation.public_id),
            "name": organisation.name,
            "timezone": organisation.timezone,
            "phone": organisation.phone,
            "businessEmail": organisation.business_email,
            "address": organisation.address,
            "description": organisation.description,
            "logoUrl": _asset_url(organisation.pk, organisation.logo_asset_id),
            "bankName": organisation.bank_name,
            "bankAccountType": organisation.bank_account_type,
            "bankAccountNumber": organisation.bank_account_number,
            "bankHolderTaxId": organisation.bank_holder_tax_id,
            "bankConfirmationEmail": organisation.bank_confirmation_email,
            "hasBankDetails": has_complete_bank_details(organisation),
        },
        "inventory": {
            "id": str(context.inventory.public_id),
            "name": context.inventory.name,
        },
        "membership": membership_summary(context.membership),
    }


def _viewer_payload(context: TenantContext) -> dict[str, object]:
    profile = profile_for_user(context.user)
    return {
        "viewer": {
            "id": str(context.user.public_id),
            "email": context.user.email,
            "emailVerified": context.user.is_email_verified,
            "profile": {
                "id": str(profile.public_id),
                "fullName": profile.full_name,
                "phone": profile.phone,
                "locale": profile.locale,
                "photoUrl": _asset_url(context.organisation.pk, profile.photo_asset_id),
            },
        },
        **_context_payload(context),
    }


def _complete_login(
    request: HttpRequest,
    identity: AuthenticatedIdentity,
) -> JsonResponse:
    if _is_mobile(request):
        issued = issue_mobile_session(
            identity=identity,
            device_name=request.headers.get("X-Device-Name", ""),
        )
        return success(
            {
                **_viewer_payload(identity.context),
                "accessToken": issued.raw_token,
                "tokenType": "Bearer",
                "expiresAt": issued.session.expires_at.isoformat(),
            }
        )
    django_login(request, identity.user)
    request.session["auth_session_version"] = identity.user.session_version
    persist_tenant_context(request, identity.context)
    return success(_viewer_payload(identity.context))


@endpoint("GET")
def csrf_token(request: HttpRequest) -> HttpResponse:
    return success({"csrfToken": get_token(request)})


@endpoint("POST")
def register_view(request: HttpRequest) -> HttpResponse:
    payload = _body(request)
    email = _string(payload, "email")
    ip_address = _client_ip(request)
    require_turnstile(
        token=_string(payload, "turnstileToken"),
        remote_ip=ip_address,
    )
    enforce_auth_rate_limit(
        action="register",
        identity=canonical_email(email),
        ip_address=ip_address,
    )
    if payload.get("acceptedTerms") is not True:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"acceptedTerms": ["Debes aceptar los términos para continuar."]},
        )
    result = register(
        email=email,
        password=_string(payload, "password"),
        full_name=_string(payload, "fullName"),
        organisation_name=_string(payload, "organisationName") or None,
    )
    if result.context is not None:
        record_audit_event(
            action="identity.register",
            organisation=result.context.organisation,
            actor=result.context.user,
            object_type="User",
            object_public_id=str(result.context.user.public_id),
            correlation_id=get_correlation_id(request),
        )
    return success(
        {
            "message": (
                "Si el registro puede completarse, recibirás un enlace para verificar tu correo."
            ),
            "verificationRequired": True,
        },
        status=202,
    )


@endpoint("POST")
def login_view(request: HttpRequest) -> HttpResponse:
    payload = _body(request)
    email = _string(payload, "email")
    ip_address = _client_ip(request)
    require_turnstile(
        token=_string(payload, "turnstileToken"),
        remote_ip=ip_address,
    )
    enforce_auth_rate_limit(
        action="login",
        identity=canonical_email(email),
        ip_address=ip_address,
    )
    try:
        identity = authenticate_password(
            email=email,
            password=_string(payload, "password"),
        )
    except DomainError as exc:
        record_audit_event(
            action="identity.login",
            outcome=AuditEvent.Outcome.FAILURE,
            correlation_id=get_correlation_id(request),
            metadata={"code": exc.code},
        )
        raise
    clear_auth_rate_limit(
        action="login",
        identity=canonical_email(email),
        ip_address=ip_address,
    )
    record_audit_event(
        action="identity.login",
        organisation=identity.context.organisation,
        actor=identity.user,
        object_type="User",
        object_public_id=str(identity.user.public_id),
        correlation_id=get_correlation_id(request),
    )
    return _complete_login(request, identity)


@endpoint("POST")
def logout_view(request: HttpRequest) -> HttpResponse:
    user = _require_user(request)
    context = get_tenant_context(request)
    payload = _body(request)
    if payload.get("allSessions") is True:
        revoke_all_sessions(user)
    else:
        mobile_session = get_mobile_session(request)
        if mobile_session is not None:
            revoke_mobile_session(mobile_session)
    if get_mobile_session(request) is None:
        django_logout(request)
    record_audit_event(
        action="identity.logout",
        organisation=context.organisation if context is not None else None,
        actor=user,
        object_type="User",
        object_public_id=str(user.public_id),
        correlation_id=get_correlation_id(request),
        metadata={"allSessions": payload.get("allSessions") is True},
    )
    return success({"loggedOut": True})


@endpoint("GET")
def viewer_view(request: HttpRequest) -> HttpResponse:
    return success(_viewer_payload(_require_context(request)))


@endpoint("POST")
def verify_email_view(request: HttpRequest) -> HttpResponse:
    payload = _body(request)
    raw_token = _string(payload, "token")
    enforce_auth_rate_limit(
        action="verify_email",
        identity=raw_token,
        ip_address=_client_ip(request),
    )
    return _complete_login(request, verify_email(raw_token=raw_token))


@endpoint("POST")
def resend_verification_view(request: HttpRequest) -> HttpResponse:
    payload = _body(request)
    email = _string(payload, "email")
    enforce_auth_rate_limit(
        action="resend_verification",
        identity=canonical_email(email),
        ip_address=_client_ip(request),
    )
    request_email_verification(email=email)
    return success(
        {
            "message": (
                "Si el correo corresponde a una cuenta pendiente, enviaremos un nuevo enlace."
            )
        },
        status=202,
    )


@endpoint("POST")
def request_password_reset_view(request: HttpRequest) -> HttpResponse:
    payload = _body(request)
    email = _string(payload, "email")
    enforce_auth_rate_limit(
        action="password_reset_request",
        identity=canonical_email(email),
        ip_address=_client_ip(request),
    )
    request_password_reset(email=email)
    return success(
        {
            "message": (
                "Si existe una cuenta para ese correo, enviaremos instrucciones "
                "para recuperar el acceso."
            )
        },
        status=202,
    )


@endpoint("POST")
def confirm_password_reset_view(request: HttpRequest) -> HttpResponse:
    payload = _body(request)
    raw_token = _string(payload, "token")
    enforce_auth_rate_limit(
        action="password_reset_confirm",
        identity=raw_token,
        ip_address=_client_ip(request),
    )
    confirm_password_reset(
        raw_token=raw_token,
        new_password=_string(payload, "password"),
    )
    return success(
        {
            "message": "Tu contraseña fue actualizada. Inicia sesión nuevamente.",
            "sessionsRevoked": True,
        }
    )


@endpoint("POST")
def switch_context_view(request: HttpRequest) -> HttpResponse:
    user = _require_user(request)
    payload = _body(request)
    try:
        organisation_id = uuid.UUID(_string(payload, "organisationId"))
        inventory_id = uuid.UUID(_string(payload, "inventoryId"))
    except ValueError as exc:
        raise ResourceNotFound() from exc
    context = resolve_tenant_context(
        user,
        organisation_id=organisation_id,
        inventory_id=inventory_id,
    )
    persist_tenant_context(request, context)
    return success(_viewer_payload(context))


@endpoint("GET")
def sessions_view(request: HttpRequest) -> HttpResponse:
    user = _require_user(request)
    sessions = [
        {
            "id": str(session.public_id),
            "deviceName": session.device_name,
            "createdAt": session.created_at.isoformat(),
            "lastSeenAt": (session.last_seen_at.isoformat() if session.last_seen_at else None),
            "expiresAt": session.expires_at.isoformat(),
            "revoked": session.revoked_at is not None,
        }
        for session in mobile_sessions_for_user(user)
    ]
    return success({"sessions": sessions})


@endpoint("POST")
def revoke_session_view(request: HttpRequest) -> HttpResponse:
    user = _require_user(request)
    payload = _body(request)
    session_id = session_public_id(_string(payload, "sessionId"))
    session = revoke_mobile_session_by_id(user=user, public_id=session_id)
    return success({"sessionId": str(session.public_id), "revoked": True})


@endpoint("GET")
def social_start_view(request: HttpRequest, provider: str) -> HttpResponse:
    client = request.GET.get("client", OIDCLoginState.Client.WEB)
    enforce_auth_rate_limit(
        action="oidc_start",
        identity=provider,
        ip_address=_client_ip(request),
    )
    callback_url = (
        settings.GOOGLE_OIDC_CALLBACK_URL
        if provider == "google"
        else settings.LINKEDIN_OIDC_CALLBACK_URL
    )
    start = begin_oidc(
        provider_name=provider,
        client=client,
        callback_url=str(callback_url),
        return_to=request.GET.get("returnTo", ""),
    )
    return success({"authorizationUrl": start.authorization_url, "provider": provider})


@endpoint("GET")
def social_callback_view(request: HttpRequest, provider: str) -> HttpResponse:
    raw_state = request.GET.get("state", "")
    code = request.GET.get("code", "")
    enforce_auth_rate_limit(
        action="oidc_callback",
        identity=provider,
        ip_address=_client_ip(request),
    )
    completion = complete_oidc(
        provider_name=provider,
        raw_state=raw_state,
        code=code,
    )
    identity = completion.identity
    if completion.client == OIDCLoginState.Client.MOBILE:
        issued = issue_mobile_session(identity=identity, device_name="Google OIDC")
        redirect = mobile_oidc_app_redirect(
            return_to=completion.return_to,
            raw_token=issued.raw_token,
            expires_at=issued.session.expires_at,
        )
        if redirect is not None:
            return MobileAppRedirect(redirect)
        return success(
            {
                **_viewer_payload(identity.context),
                "accessToken": issued.raw_token,
                "tokenType": "Bearer",
                "expiresAt": issued.session.expires_at.isoformat(),
            }
        )
    django_login(request, identity.user)
    request.session["auth_session_version"] = identity.user.session_version
    persist_tenant_context(request, identity.context)
    return HttpResponseRedirect(f"{settings.WEB_ORIGIN}/app")
