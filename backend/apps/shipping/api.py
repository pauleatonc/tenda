"""Public shipment HTML and buyer confirmation adapter."""

from __future__ import annotations

import json
from typing import Any

from django.http import HttpRequest, HttpResponse
from django.utils.html import escape

from apps.users.api import endpoint, success
from apps.users.middleware import get_correlation_id
from apps.users.services import enforce_auth_rate_limit
from tenda.antibot import verify_turnstile
from tenda.errors import DomainError

from .selectors import (
    public_allowed_actions,
    public_status_for,
    public_status_label,
)
from .services import confirm_public_shipment, public_shipment_for_token

_UNAVAILABLE_HTML = (
    '<!doctype html><html lang="es"><head><meta charset="utf-8">'
    '<meta name="robots" content="noindex,nofollow">'
    "<title>Enlace no disponible · Tenda</title></head>"
    "<body><main><h1>Este enlace no está disponible</h1>"
    "<p>Solicita un enlace actualizado al vendedor.</p></main></body></html>"
)


def _json_body(request: HttpRequest) -> dict[str, Any]:
    if len(request.body) > 64 * 1024:
        raise DomainError("PAYLOAD_TOO_LARGE", "El cuerpo es demasiado grande.", status=413)
    try:
        value = json.loads(request.body.decode("utf-8") or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DomainError("INVALID_JSON", "El cuerpo JSON no es válido.") from exc
    if not isinstance(value, dict):
        raise DomainError("INVALID_JSON", "El cuerpo JSON no es válido.")
    return value


def public_shipment_page(request: HttpRequest, token: str) -> HttpResponse:
    if request.method != "GET":
        return HttpResponse(status=405)
    try:
        shipment = public_shipment_for_token(token)
    except DomainError:
        return HttpResponse(
            _UNAVAILABLE_HTML,
            status=404,
            content_type="text/html; charset=utf-8",
        )
    organisation = shipment.organisation
    item_names = [item.product_name for item in shipment.order.items.all()[:3]]
    product_summary = ", ".join(item_names) or "Pedido"
    title = f"{product_summary} · {organisation.name}"
    status_label = public_status_label(shipment)
    description = f"Sigue el envío de {organisation.name}. Estado: {status_label}."
    tracking = shipment.tracking_code or "Sin tracking todavía"
    canonical = request.build_absolute_uri()
    html = (
        '<!doctype html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="robots" content="noindex,nofollow">'
        f"<title>{escape(title)}</title>"
        f'<meta property="og:title" content="{escape(title)}">'
        f'<meta property="og:description" content="{escape(description)}">'
        f'<meta property="og:url" content="{escape(canonical)}">'
        '<meta property="og:type" content="website">'
        '</head><body><main id="tenda-public-shipment">'
        f"<h1>{escape(title)}</h1><p>{escape(description)}</p>"
        f"<p>Pedido {escape(shipment.order.number)}</p>"
        f"<p>Envío {escape(shipment.number)}</p>"
        f"<p>Estado {escape(status_label)}</p>"
        f"<p>Tracking {escape(tracking)}</p>"
        "</main></body></html>"
    )
    return HttpResponse(html, content_type="text/html; charset=utf-8")


@endpoint("POST")
def confirm_public_shipment_view(request: HttpRequest, token: str) -> HttpResponse:
    payload = _json_body(request)
    remote_ip = str(request.META.get("REMOTE_ADDR", ""))[:64]
    enforce_auth_rate_limit(
        action="public_shipment_confirm",
        identity=token,
        ip_address=remote_ip,
    )
    verify_turnstile(
        token=str(payload.get("turnstileToken", "")),
        remote_ip=remote_ip,
    )
    result = confirm_public_shipment(
        token=token,
        outcome=str(payload.get("outcome", "")).strip(),
        comment=str(payload.get("comment", "")),
        idempotency_key=str(
            payload.get("idempotencyKey") or request.headers.get("Idempotency-Key") or ""
        ),
        correlation_id=get_correlation_id(request),
    )
    shipment = result.shipment
    next_action = (
        "open_ticket"
        if result.confirmation.outcome == result.confirmation.Outcome.NEEDS_HELP
        else "none"
    )
    return success(
        {
            "replayed": result.replayed,
            "outcome": result.confirmation.outcome,
            "publicStatus": public_status_for(shipment),
            "publicStatusLabel": public_status_label(shipment),
            "nextAction": next_action,
            "allowedActions": list(public_allowed_actions(shipment)),
        }
    )
