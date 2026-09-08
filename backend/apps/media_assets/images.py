"""Resize display images into thumbnail, medium and large WebP variants."""

from __future__ import annotations

from io import BytesIO

from django.conf import settings
from PIL import Image, ImageOps, UnidentifiedImageError

from apps.media_assets.keys import MEDIA_PURPOSES
from tenda.errors import DomainError

_VARIANT_CONTENT_TYPE = "image/webp"


def is_display_image_purpose(purpose: str) -> bool:
    return purpose in MEDIA_PURPOSES


def render_image_variants(content: bytes) -> dict[str, bytes]:
    """Fit the source into each configured longest-edge box. Never upscale."""

    try:
        image = Image.open(BytesIO(content))
        image.load()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise DomainError(
            "INVALID_IMAGE",
            "El archivo no es una imagen válida.",
        ) from exc
    image = ImageOps.exif_transpose(image)
    image = _display_mode(image)
    names = tuple(getattr(settings, "IMAGE_VARIANT_NAMES", ("thumbnail", "medium", "large")))
    edges = dict(getattr(settings, "IMAGE_VARIANT_MAX_EDGE", {}))
    quality = int(getattr(settings, "IMAGE_VARIANT_QUALITY", 82))
    rendered: dict[str, bytes] = {}
    for name in names:
        max_edge = int(edges.get(name, 0))
        if max_edge <= 0:
            continue
        frame = image.copy()
        frame.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        buffer = BytesIO()
        frame.save(
            buffer,
            format=str(getattr(settings, "IMAGE_VARIANT_FORMAT", "WEBP")),
            quality=quality,
            method=4,
        )
        rendered[name] = buffer.getvalue()
    if not rendered:
        raise DomainError("INVALID_IMAGE", "No pudimos generar las versiones de la imagen.")
    return rendered


def variant_content_type() -> str:
    return str(getattr(settings, "IMAGE_VARIANT_CONTENT_TYPE", _VARIANT_CONTENT_TYPE))


def _display_mode(image: Image.Image) -> Image.Image:
    if image.mode in {"RGB", "RGBA"}:
        return image
    if image.mode in {"P", "PA", "LA"} or "A" in image.getbands():
        return image.convert("RGBA")
    return image.convert("RGB")
