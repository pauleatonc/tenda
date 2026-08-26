"""Public contact adapter."""

from __future__ import annotations

import json

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import HttpRequest, JsonResponse

from apps.notifications.models import ContactRequest
from apps.users.middleware import get_correlation_id
from apps.users.services import enforce_auth_rate_limit
from tenda.antibot import verify_turnstile
from tenda.errors import DomainError


def _error(request: HttpRequest, error: DomainError) -> JsonResponse:
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


def contact(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return _error(
            request,
            DomainError("METHOD_NOT_ALLOWED", "Método no permitido.", status=405),
        )
    try:
        try:
            payload = json.loads(request.body or b"{}")
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise DomainError("INVALID_JSON", "El cuerpo JSON no es válido.") from exc
        if not isinstance(payload, dict):
            raise DomainError("INVALID_JSON", "El cuerpo JSON no es válido.")

        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip().lower()
        message = str(payload.get("message", "")).strip()
        field_errors: dict[str, list[str]] = {}
        if not name:
            field_errors["name"] = ["Ingresa tu nombre."]
        try:
            validate_email(email)
        except ValidationError:
            field_errors["email"] = ["Ingresa un correo válido."]
        if len(message) < 10:
            field_errors["message"] = ["Cuéntanos un poco más para poder ayudarte."]
        if len(message) > 4000:
            field_errors["message"] = ["El mensaje no puede superar 4000 caracteres."]
        if field_errors:
            raise DomainError(
                "VALIDATION_ERROR",
                "Revisa los datos ingresados.",
                field_errors=field_errors,
            )

        remote_ip = str(request.META.get("REMOTE_ADDR", ""))[:64]
        enforce_auth_rate_limit(
            action="public_contact",
            identity=email,
            ip_address=remote_ip,
        )
        verify_turnstile(
            token=str(payload.get("turnstileToken", "")),
            remote_ip=remote_ip,
        )
        ContactRequest.objects.create(name=name, email=email, message=message)
        return JsonResponse(
            {
                "data": {
                    "accepted": True,
                    "message": "Recibimos tu mensaje. Te responderemos pronto.",
                }
            },
            status=202,
        )
    except DomainError as exc:
        return _error(request, exc)
