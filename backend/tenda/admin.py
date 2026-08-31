"""Django Admin as the general maintainer for local and support operations."""

from __future__ import annotations

import hashlib
import secrets
from typing import Any

from django.contrib import admin
from django.db import models
from django.http import HttpRequest

from apps.media_assets.keys import build_object_key
from tenda.crypto import encrypt_credential

SECRET_FIELD_NAMES = frozenset(
    {
        "token_digest",
        "state_digest",
        "state_hash",
        "key_digest",
        "ciphertext",
        "access_token_ciphertext",
        "refresh_token_ciphertext",
        "public_token_hash",
        "public_token_ciphertext",
    }
)

GENERATED_HASH_FIELDS = frozenset(
    {
        "token_digest",
        "state_digest",
        "state_hash",
        "key_digest",
    }
)

_AUTO_READONLY = frozenset(
    {
        "created_at",
        "updated_at",
        "received_at",
        "attempted_at",
        "date_joined",
        "last_login",
    }
)


def configure_admin_site() -> None:
    admin.site.site_header = "Tenda"
    admin.site.site_title = "Tenda"
    admin.site.index_title = "Mantenedor general"


def _digest(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def provision_generated_fields(obj: models.Model) -> None:
    """Fill hashed/encrypted columns that Admin must never collect from a form."""

    fields = {field.name for field in obj._meta.fields}
    token = secrets.token_urlsafe(32)
    digest = _digest(token)

    if "public_token_hash" in fields and not getattr(obj, "public_token_hash", ""):
        obj.public_token_hash = digest  # type: ignore[attr-defined]
        if "public_token_ciphertext" in fields:
            obj.public_token_ciphertext = encrypt_credential(token)  # type: ignore[attr-defined]
        token = secrets.token_urlsafe(32)
        digest = _digest(token)

    for name in GENERATED_HASH_FIELDS:
        if name in fields and not getattr(obj, name, ""):
            setattr(obj, name, digest)
            token = secrets.token_urlsafe(32)
            digest = _digest(token)

    if "ciphertext" in fields and not getattr(obj, "ciphertext", ""):
        obj.ciphertext = encrypt_credential("")  # type: ignore[attr-defined]

    if "token_prefix" in fields and not getattr(obj, "token_prefix", ""):
        obj.token_prefix = secrets.token_hex(6)  # type: ignore[attr-defined]

    if "object_key" in fields and not getattr(obj, "object_key", ""):
        public_id = getattr(obj, "public_id", None)
        organisation = getattr(obj, "organisation", None)
        purpose = getattr(obj, "purpose", "file")
        original_name = str(getattr(obj, "original_name", "file") or "file")
        org_part = getattr(organisation, "public_id", "unscoped")
        obj.object_key = build_object_key(  # type: ignore[attr-defined]
            organisation_id=org_part,
            purpose=str(purpose),
            public_id=public_id or "file",
            original_name=original_name,
        )


class MaintainerModelAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    """Writable admin that hides secrets and respects append-only ledgers."""

    append_only = False
    forbid_delete = False
    preserve_filters = True

    def get_exclude(
        self,
        request: HttpRequest,
        obj: Any | None = None,
    ) -> tuple[str, ...] | None:
        excluded = list(super().get_exclude(request, obj) or ())
        for field in self.model._meta.fields:
            if field.name in SECRET_FIELD_NAMES and field.name not in excluded:
                excluded.append(field.name)
        return tuple(excluded) or None

    def get_readonly_fields(
        self,
        request: HttpRequest,
        obj: Any | None = None,
    ) -> tuple[str, ...]:
        if self.append_only and obj is not None:
            return tuple(field.name for field in self.model._meta.local_fields)
        readonly = list(super().get_readonly_fields(request, obj))
        for field in self.model._meta.fields:
            if field.name in SECRET_FIELD_NAMES or field.name in readonly:
                continue
            if not field.editable or field.name in _AUTO_READONLY:
                readonly.append(field.name)
        return tuple(readonly)

    def has_delete_permission(
        self,
        request: HttpRequest,
        obj: Any | None = None,
    ) -> bool:
        if self.forbid_delete or self.append_only:
            return False
        return bool(super().has_delete_permission(request, obj))

    def save_model(
        self,
        request: HttpRequest,
        obj: Any,
        form: Any,
        change: bool,
    ) -> None:
        if not change:
            provision_generated_fields(obj)
        super().save_model(request, obj, form, change)
