"""Canonical object-key layout for private storage.

R2 keys look like:

    {R2_PREFIX}/organisations/{org_id}/{media|documents}/{purpose}/…

The prefix lives only in the R2 adapter so local, Dev and Prod can share one
bucket without rewriting rows. Backups use a separate bucket.
"""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

from django.conf import settings

from apps.media_assets.models import MediaAsset

MEDIA_PURPOSES = frozenset(
    {
        MediaAsset.Purpose.PRODUCT_IMAGE,
        MediaAsset.Purpose.PROFILE_PHOTO,
        MediaAsset.Purpose.ORGANISATION_LOGO,
    }
)


def storage_kind(purpose: str) -> str:
    return "media" if purpose in MEDIA_PURPOSES else "documents"


def build_object_key(
    *,
    organisation_id: UUID | str,
    purpose: str,
    public_id: UUID | str,
    original_name: str = "",
    extra: str = "",
) -> str:
    extension = Path(original_name).suffix.lower()[:12]
    parts = [
        "organisations",
        str(organisation_id),
        storage_kind(purpose),
        purpose,
    ]
    if extra:
        parts.append(str(extra))
    return f"{'/'.join(parts)}/{public_id}{extension}"


def build_variant_key(
    *,
    organisation_id: UUID | str,
    purpose: str,
    public_id: UUID | str,
    variant: str,
    content_hash: str,
) -> str:
    digest = content_hash.lower()
    return (
        f"organisations/{organisation_id}/{storage_kind(purpose)}/{purpose}"
        f"/{public_id}/{variant}-{digest[:32]}.webp"
    )


def r2_object_key(key: str) -> str:
    prefix = str(getattr(settings, "R2_PREFIX", "") or "").strip().strip("/")
    relative = key.lstrip("/")
    if not prefix:
        return relative
    return f"{prefix}/{relative}"
