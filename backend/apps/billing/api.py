"""HTTP webhook adapter for Mercado Pago SaaS billing."""

from __future__ import annotations

import json
from hashlib import sha256
from typing import Any

from django.db import transaction
from django.http import HttpRequest, HttpResponse
from django.views.decorators.csrf import csrf_exempt

from apps.users.api import endpoint, success
from tenda.errors import DomainError

from .models import BillingWebhookEvent
from .provider import get_billing_provider
from .tasks import process_billing_webhook


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
def mercado_pago_billing_webhook(request: HttpRequest) -> HttpResponse:
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
    event, created = BillingWebhookEvent.objects.get_or_create(
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
        normalized = get_billing_provider().verify_webhook(
            payload=payload,
            signature=request.headers.get("X-Signature", ""),
            request_id=request.headers.get("X-Request-ID", ""),
            query_data_id=request.GET.get("data.id", ""),
        )
    except DomainError:
        BillingWebhookEvent.objects.filter(pk=event.pk).update(
            status=BillingWebhookEvent.Status.IGNORED,
            last_error="INVALID_WEBHOOK_SIGNATURE",
        )
        raise

    event.event_type = normalized.event_type[:120]
    event.provider_resource_id = normalized.resource_id[:160]
    event.normalized_payload = {
        "eventId": normalized.event_id,
        "eventType": normalized.event_type,
        "resourceId": normalized.resource_id,
    }
    event.signature_valid = True
    event.save(
        update_fields=(
            "event_type",
            "provider_resource_id",
            "normalized_payload",
            "signature_valid",
            "updated_at",
        )
    )
    should_enqueue = created or not was_valid or event.status in {
        BillingWebhookEvent.Status.RECEIVED,
        BillingWebhookEvent.Status.FAILED,
    }
    if should_enqueue:
        transaction.on_commit(
            lambda: process_billing_webhook.delay(event.pk)  # type: ignore[attr-defined]
        )
    return success({"accepted": True, "eventId": str(event.public_id)})
