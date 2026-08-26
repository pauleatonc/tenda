"""Versioned private upload adapters."""

from __future__ import annotations

import json
import uuid
from typing import Any

from django.conf import settings
from django.http import HttpRequest, HttpResponse

from apps.organisations.selectors import TenantContext
from apps.users.api import endpoint, success
from apps.users.middleware import get_tenant_context
from tenda.errors import AuthenticationRequired, DomainError, ResourceNotFound

from .services import accept_fake_upload, complete_upload, prepare_upload, private_download_url


def _body(request: HttpRequest) -> dict[str, Any]:
    try:
        value = json.loads(request.body or b"{}")
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise DomainError("INVALID_JSON", "El cuerpo JSON no es válido.") from exc
    if not isinstance(value, dict):
        raise DomainError("INVALID_JSON", "El cuerpo JSON no es válido.")
    return value


def _context(request: HttpRequest) -> TenantContext:
    if not request.user.is_authenticated:
        raise AuthenticationRequired()
    context = get_tenant_context(request)
    if context is None:
        raise ResourceNotFound()
    return context


def _public_id(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise ResourceNotFound() from exc


@endpoint("POST")
def prepare_upload_view(request: HttpRequest) -> HttpResponse:
    payload = _body(request)
    try:
        size = int(payload.get("size", 0))
    except (TypeError, ValueError) as exc:
        raise DomainError(
            "INVALID_UPLOAD",
            "El archivo no cumple los requisitos.",
            field_errors={"size": ["El tamaño no es válido."]},
        ) from exc
    prepared = prepare_upload(
        context=_context(request),
        purpose=str(payload.get("purpose", "")),
        original_name=str(payload.get("fileName", "")),
        content_type=str(payload.get("contentType", "")),
        size=size,
    )
    upload_url = prepared.upload.url
    if str(getattr(settings, "OBJECT_STORAGE_PROVIDER", "fake")) == "fake":
        upload_url = request.build_absolute_uri(
            f"/api/v1/media/uploads/fake/{prepared.asset.public_id}"
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


@endpoint("POST")
def complete_upload_view(request: HttpRequest) -> HttpResponse:
    payload = _body(request)
    asset = complete_upload(
        context=_context(request),
        public_id=_public_id(payload.get("assetId")),
    )
    return success({"assetId": str(asset.public_id), "status": asset.status})


@endpoint("PUT")
def fake_upload_view(request: HttpRequest, asset_id: str) -> HttpResponse:
    asset = accept_fake_upload(
        context=_context(request),
        public_id=_public_id(asset_id),
        content=request.body,
        content_type=str(request.content_type or ""),
    )
    return success({"assetId": str(asset.public_id), "status": asset.status})


@endpoint("GET")
def download_view(request: HttpRequest, asset_id: str) -> HttpResponse:
    return success(
        {
            "url": private_download_url(
                context=_context(request),
                public_id=_public_id(asset_id),
            ),
            "expiresIn": 300,
        }
    )
