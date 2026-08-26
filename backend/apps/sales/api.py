"""Provider callbacks, public order HTML and scoped receipt upload adapters."""

from __future__ import annotations

import json
import uuid
from hashlib import sha256
from typing import Any
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.utils.html import escape
from django.views.decorators.csrf import csrf_exempt

from apps.users.api import endpoint, success
from apps.users.middleware import get_correlation_id
from tenda.errors import DomainError

from .models import PaymentWebhookEvent
from .order_services import public_order_for_token
from .payments import get_payment_provider
from .services import complete_seller_payment_connection
from .uploads import (
    accept_fake_receipt_upload,
    complete_receipt_upload,
    prepare_receipt_upload,
)


def _payload(request: HttpRequest) -> tuple[str, dict[str, Any]]:
    if len(request.body) > 1024 * 1024:
        raise DomainError("PAYLOAD_TOO_LARGE", "El webhook es demasiado grande.", status=413)
    try:
        raw_body = request.body.decode("utf-8")
        value = json.loads(raw_body or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise DomainError("INVALID_JSON", "El cuerpo JSON no es válido.") from exc
    if not isinstance(value, dict):
        raise DomainError("INVALID_JSON", "El cuerpo JSON no es válido.")
    return raw_body, value


@csrf_exempt
@endpoint("POST")
def mercado_pago_webhook(request: HttpRequest) -> HttpResponse:
    raw_body, payload = _payload(request)
    resource = payload.get("data", {})
    raw_resource_id = (
        str(resource.get("id", "")) if isinstance(resource, dict) else ""
    ) or request.GET.get("data.id", "")
    raw_event_id = str(
        payload.get("id")
        or f"{payload.get('type', 'event')}:{raw_resource_id}"
        or sha256(raw_body.encode()).hexdigest()
    )
    minimized = {
        "id": payload.get("id"),
        "type": payload.get("type"),
        "action": payload.get("action"),
        "data": {"id": raw_resource_id},
        "user_id": payload.get("user_id"),
    }
    event, created = PaymentWebhookEvent.objects.get_or_create(
        provider="mercado_pago",
        provider_event_id=raw_event_id[:160],
        defaults={
            "event_type": str(payload.get("type", "unknown"))[:120],
            "raw_body": json.dumps(minimized, separators=(",", ":"), ensure_ascii=False),
            "safe_headers": {
                "xRequestId": request.headers.get("X-Request-ID", "")[:160],
                "contentType": request.content_type,
            },
            "normalized_payload": {},
            "provider_resource_id": raw_resource_id[:160],
        },
    )
    was_valid = event.signature_valid
    try:
        normalized = get_payment_provider().verify_webhook(
            payload=payload,
            signature=request.headers.get("X-Signature", ""),
            request_id=request.headers.get("X-Request-ID", ""),
            query_data_id=request.GET.get("data.id", ""),
        )
    except DomainError:
        PaymentWebhookEvent.objects.filter(pk=event.pk).update(
            status=PaymentWebhookEvent.Status.IGNORED,
            last_error="INVALID_WEBHOOK_SIGNATURE",
        )
        raise
    event.event_type = normalized.event_type[:120]
    event.provider_resource_id = normalized.resource_id[:160]
    event.normalized_payload = {
        "resourceId": normalized.resource_id,
        "eventType": normalized.event_type,
        "providerAccountId": normalized.provider_account_id,
    }
    event.signature_valid = True
    event.status = PaymentWebhookEvent.Status.RECEIVED
    event.last_error = ""
    event.save(
        update_fields=(
            "event_type",
            "provider_resource_id",
            "normalized_payload",
            "signature_valid",
            "status",
            "last_error",
        )
    )

    from .tasks import process_payment_webhook

    transaction.on_commit(lambda: process_payment_webhook.delay(event.pk))
    return success(
        {
            "accepted": True,
            "duplicate": (not created and was_valid),
            "eventId": str(event.public_id),
        }
    )


def mercado_pago_oauth_callback(request: HttpRequest) -> HttpResponse:
    """Finish provider OAuth and return to the fixed application settings route."""
    if request.method != "GET":
        return HttpResponse(status=405)
    result = "connected"
    error_code = ""
    try:
        complete_seller_payment_connection(
            state=request.GET.get("state", ""),
            code=request.GET.get("code", ""),
            correlation_id=get_correlation_id(request),
        )
    except DomainError as exc:
        result = "error"
        error_code = exc.code
    query = urlencode(
        {
            "paymentConnection": result,
            **({"code": error_code} if error_code else {}),
        }
    )
    return HttpResponseRedirect(
        f"{settings.WEB_ORIGIN}/app/configuracion?{query}",
    )


def public_order_page(request: HttpRequest, token: str) -> HttpResponse:
    if request.method != "GET":
        return HttpResponse(status=405)
    try:
        order = public_order_for_token(token)
    except DomainError:
        return HttpResponse(
            (
                '<!doctype html><html lang="es"><head><meta charset="utf-8">'
                '<meta name="robots" content="noindex,nofollow">'
                "<title>Enlace no disponible · Tenda</title></head>"
                "<body><main><h1>Este enlace no está disponible</h1>"
                "<p>Solicita un enlace actualizado al vendedor.</p></main></body></html>"
            ),
            status=404,
            content_type="text/html; charset=utf-8",
        )
    item_names = [item.product_name for item in order.items.all()[:3]]
    product_summary = ", ".join(item_names) or "Pedido"
    expired = order.status == order.Status.EXPIRED
    title = (
        "Enlace de compra expirado" if expired else f"{product_summary} · {order.organisation.name}"
    )
    description = (
        "La reserva terminó. Solicita un enlace actualizado al vendedor."
        if expired
        else f"Revisa tu pedido por {order.total_amount} CLP en {order.organisation.name}."
    )
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
        '</head><body><main id="tenda-public-order">'
        f"<h1>{escape(title)}</h1><p>{escape(description)}</p>"
        f"<p>Pedido {escape(order.number)}</p>"
        "</main></body></html>"
    )
    return HttpResponse(html, content_type="text/html; charset=utf-8")


def _body_size(payload: dict[str, Any]) -> int:
    try:
        return int(payload.get("size", 0))
    except (TypeError, ValueError) as exc:
        raise DomainError(
            "INVALID_UPLOAD",
            "El archivo no cumple los requisitos.",
            field_errors={"size": ["El tamaño no es válido."]},
        ) from exc


def _asset_id(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise DomainError(
            "NOT_FOUND",
            "No encontramos el recurso solicitado.",
            status=404,
        ) from exc


@endpoint("POST")
def prepare_public_receipt(request: HttpRequest, token: str) -> HttpResponse:
    payload = _payload(request)[1]
    prepared = prepare_receipt_upload(
        token=token,
        original_name=str(payload.get("fileName", "")),
        content_type=str(payload.get("contentType", "")),
        size=_body_size(payload),
    )
    upload_url = prepared.upload.url
    if str(getattr(settings, "OBJECT_STORAGE_PROVIDER", "fake")) == "fake":
        upload_url = request.build_absolute_uri(
            f"/api/v1/public/orders/{token}/payment-proof/uploads/fake/{prepared.asset.public_id}"
        )
    return success(
        {
            "assetId": str(prepared.asset.public_id),
            "uploadUrl": upload_url,
            "headers": prepared.upload.headers,
            "expiresIn": prepared.upload.expires_in_seconds,
        },
        status=201,
    )


@endpoint("PUT")
def fake_public_receipt(
    request: HttpRequest,
    token: str,
    asset_id: str,
) -> HttpResponse:
    asset = accept_fake_receipt_upload(
        token=token,
        asset_id=_asset_id(asset_id),
        content=request.body,
        content_type=str(request.content_type or ""),
    )
    return success({"assetId": str(asset.public_id), "status": asset.status})


@endpoint("POST")
def complete_public_receipt(request: HttpRequest, token: str) -> HttpResponse:
    payload = _payload(request)[1]
    proof = complete_receipt_upload(
        token=token,
        asset_id=_asset_id(payload.get("assetId")),
        correlation_id=get_correlation_id(request),
    )
    return success(
        {
            "assetId": str(proof.asset.public_id),
            "status": proof.status,
            "orderStatus": proof.payment.order.status,
        }
    )
