"""Suggest catalogue drafts from a product photo.

The seller still creates the product. This module only proposes 3–5 candidates
mapped to the active schema of that store. The fake provider is deterministic
for tests; NVIDIA is a VLM plus a separate web search step.
"""

from __future__ import annotations

import base64
import hashlib
import html
import json
import logging
import re
import uuid
from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, replace
from decimal import Decimal, InvalidOperation
from typing import Any, Protocol
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import httpx
from django.conf import settings

from apps.audit.idempotency import execute_idempotent
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import read_ready_asset, ready_asset
from apps.organisations.selectors import TenantContext
from tenda.errors import DomainError

from .custom_fields import clean_value
from .models import CustomFieldDefinition
from .selectors import active_custom_fields

logger = logging.getLogger(__name__)

MIN_CANDIDATES = 3
MAX_CANDIDATES = 5
MAX_NAME_LENGTH = 160
SEARCH_TIMEOUT_SECONDS = 8.0
VISION_TIMEOUT_SECONDS = 18.0
# Extract sends schema + search hits; NIM often exceeds the 18s describe budget.
EXTRACT_TIMEOUT_SECONDS = 45.0
PAGE_IMAGE_TIMEOUT_SECONDS = 6.0
MAX_PAGE_BYTES = 2_100_000
NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-CL,es;q=0.9,en;q=0.8",
}
BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"
DUCKDUCKGO_HTML_URL = "https://html.duckduckgo.com/html/"

_JSON_BLOCK = re.compile(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", re.DOTALL)
_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)
_RESULT_LINK = re.compile(
    r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_RESULT_SNIPPET = re.compile(
    r'<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_OG_IMAGE = re.compile(
    r'<meta[^>]+(?:property|name)=["\'](?:og:image|twitter:image)["\'][^>]+'
    r'content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
_OG_IMAGE_ALT = re.compile(
    r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+'
    r'(?:property|name)=["\'](?:og:image|twitter:image)["\']',
    re.IGNORECASE,
)
_IMAGE_EXT = re.compile(r"\.(?:jpe?g|png|webp|gif|avif|bmp)(?:\?|#|$)", re.IGNORECASE)
_LOGO_HINT = re.compile(
    r"logo|favicon|sprite|icon|apple-touch|og_fcom|wordmark|placeholder|"
    r"/v3/assets/|frontend-assets|nav-sprite|/images/g/",
    re.IGNORECASE,
)
_PRODUCT_CDN = re.compile(
    r"(?:https?:)?//(?:"
    r"media\.falabella\.com/[^\s\"'<>\\]+|"
    r"http2\.mlstatic\.com/[^\s\"'<>\\]+|"
    r"(?:m\.)?media-amazon\.com/images/I/[A-Za-z0-9%+,._-]+"
    r"\._(?:AC|SL|UX|UY|UL|SS)[^\s\"'<>\\]*|"
    r"images-(?:eu|na)\.ssl-images-amazon\.com/images/I/[A-Za-z0-9%+,._-]+"
    r"\._(?:AC|SL|UX|UY|UL|SS)[^\s\"'<>\\]*|"
    r"(?:falabella|ripley)\.scene7\.com/[^\s\"'<>\\]+"
    r")",
    re.IGNORECASE,
)
_AMAZON_CHROME = re.compile(
    r"media-amazon\.com/images/I/(?!.*\._(?:AC|SL|UX|UY|UL|SS))",
    re.IGNORECASE,
)
_EMBEDDED_IMAGE = re.compile(
    r'"(?:image|imageUrl|thumbnailUrl|thumbnail)"\s*:\s*"(https://[^"]+)"',
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class ProductImageCandidate:
    name: str
    sale_price: int | None
    purchase_price: int | None
    extra_attributes: dict[str, Any]
    source_url: str
    image_url: str
    confidence: float

    def as_payload(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "salePrice": self.sale_price,
            "purchasePrice": self.purchase_price,
            "extraAttributes": self.extra_attributes,
            "sourceUrl": self.source_url,
            "imageUrl": self.image_url,
            "confidence": self.confidence,
        }


@dataclass(frozen=True, slots=True)
class SuggestedProducts:
    candidates: list[ProductImageCandidate]
    replayed: bool


class ProductImageSearchProvider(Protocol):
    def suggest(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
        schema: Sequence[CustomFieldDefinition],
    ) -> list[ProductImageCandidate]: ...


def _blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _clean_suggested_price(value: Any) -> int | None:
    if _blank(value):
        return None
    try:
        number = Decimal(str(value).strip().replace(",", ""))
    except (InvalidOperation, ValueError, TypeError):
        return None
    if not number.is_finite() or number < 0:
        return None
    if number != number.to_integral_value():
        return None
    if number >= Decimal("1000000000000"):
        return None
    return int(number)


def _clean_confidence(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.5
    if number < 0:
        return 0.0
    if number > 1:
        return 1.0
    return round(number, 3)


def _clean_url(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    url = value.strip()
    if not url.startswith(("http://", "https://")):
        return ""
    return url[:500]


def _url_key(url: str) -> str:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    path = parsed.path.rstrip("/")
    return f"{host}{path}"


def _public_http_url(value: Any) -> str:
    url = _clean_url(value)
    if not url:
        return ""
    host = (urlparse(url).hostname or "").lower()
    if not host or host in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
        return ""
    if host.endswith(".local") or host.endswith(".internal"):
        return ""
    if host.startswith(("10.", "192.168.", "169.254.")):
        return ""
    if host.startswith("172."):
        parts = host.split(".")
        if len(parts) > 1 and parts[1].isdigit() and 16 <= int(parts[1]) <= 31:
            return ""
    return url


def _looks_like_image_url(url: str) -> bool:
    return bool(_IMAGE_EXT.search(urlparse(url).path) or _IMAGE_EXT.search(url))


def _normalize_found_url(raw: str) -> str:
    url = html.unescape(raw).rstrip("\\").rstrip(".,);")
    if url.startswith("//"):
        url = f"https:{url}"
    return _public_http_url(url)


def _is_rejected_image(url: str) -> bool:
    if not url:
        return True
    lowered = url.lower()
    path = urlparse(lowered).path
    if path.endswith(".svg") or path.endswith(".ico"):
        return True
    if _AMAZON_CHROME.search(lowered):
        return True
    return bool(_LOGO_HINT.search(url))


def _image_score(url: str) -> int:
    cleaned = _public_http_url(url)
    if not cleaned or _is_rejected_image(cleaned):
        return -1
    score = 5
    if _PRODUCT_CDN.search(cleaned):
        score += 50
    if _looks_like_image_url(cleaned):
        score += 10
    return score


def _usable_image_hint(url: str) -> bool:
    return _looks_like_image_url(url) or bool(_PRODUCT_CDN.search(url))


def _best_image_from_html(text: str, page_url: str = "") -> str:
    """Pick a product photo from HTML, never a store logo or favicon."""

    found: list[str] = []
    for match in _OG_IMAGE.finditer(text):
        found.append(match.group(1))
    for match in _OG_IMAGE_ALT.finditer(text):
        found.append(match.group(1))
    found.extend(_PRODUCT_CDN.findall(text))
    found.extend(_EMBEDDED_IMAGE.findall(text))
    best = ""
    best_score = 0
    seen: set[str] = set()
    page_key = _url_key(page_url) if page_url else ""
    for raw in found:
        image = _normalize_found_url(raw)
        if not image or image in seen or (page_key and _url_key(image) == page_key):
            continue
        seen.add(image)
        score = _image_score(image)
        if score > best_score:
            best = image
            best_score = score
    return best if best_score >= 5 else ""


def _retailer_search_url(page_url: str, query: str) -> str:
    name = " ".join(query.split())[:80]
    if not name:
        return ""
    host = (urlparse(page_url).hostname or "").lower()
    encoded = quote_plus(name)
    if "falabella.com" in host:
        return f"https://www.falabella.com/falabella-cl/search?Ntt={encoded}"
    if host.endswith("amazon.es") or host.endswith("www.amazon.es"):
        return f"https://www.amazon.es/s?k={encoded}"
    if host.endswith("amazon.com") or host.endswith("www.amazon.com"):
        return f"https://www.amazon.com/s?k={encoded}"
    if host.endswith("paris.cl"):
        return f"https://www.paris.cl/search?q={encoded}"
    return ""


def _inspect_url_for_image(url: str) -> str:
    target = _public_http_url(url)
    if not target:
        return ""
    try:
        with httpx.Client(
            timeout=PAGE_IMAGE_TIMEOUT_SECONDS,
            follow_redirects=True,
            headers=BROWSER_HEADERS,
        ) as client:
            with client.stream("GET", target) as response:
                response.raise_for_status()
                final = _public_http_url(str(response.url))
                if not final:
                    return ""
                content_type = str(response.headers.get("content-type") or "").split(";")[0]
                if content_type.startswith("image/"):
                    return final if _image_score(final) >= 5 else ""
                if "html" not in content_type and _usable_image_hint(final):
                    return final if _image_score(final) >= 5 else ""
                pieces: list[str] = []
                tail = ""
                size = 0
                cdn_hit = ""
                for chunk in response.iter_bytes():
                    decoded = chunk.decode("utf-8", errors="ignore")
                    text = tail + decoded
                    if size < 80_000:
                        pieces.append(text if not pieces else decoded)
                    match = _PRODUCT_CDN.search(text)
                    if match:
                        cdn_hit = match.group(0)
                        break
                    tail = text[-240:]
                    size += len(chunk)
                    if size >= MAX_PAGE_BYTES:
                        break
        if cdn_hit:
            image = _normalize_found_url(cdn_hit)
            if image and _image_score(image) >= 5:
                return image
        return _best_image_from_html("".join(pieces), final)
    except (httpx.HTTPError, ValueError, TypeError):
        return ""


def _falabella_search_url(query: str) -> str:
    name = " ".join(query.split())[:80]
    if not name:
        return ""
    return f"https://www.falabella.com/falabella-cl/search?Ntt={quote_plus(name)}"


def page_image_url(url: str, query: str = "") -> str:
    """Return a product photo URL, never a store logo or product HTML page."""

    image = _inspect_url_for_image(url)
    if image:
        return image
    tried = {_url_key(url)}
    extra = _retailer_search_url(url, query)
    if extra and _url_key(extra) not in tried:
        tried.add(_url_key(extra))
        image = _inspect_url_for_image(extra)
        if image:
            return image
    fallback = _falabella_search_url(query)
    if fallback and _url_key(fallback) not in tried:
        return _inspect_url_for_image(fallback)
    return ""


def _image_candidates_for(
    candidate: ProductImageCandidate,
    hit_image: str,
) -> list[str]:
    claimed = _public_http_url(candidate.image_url)
    source = _public_http_url(candidate.source_url)
    hit_image = _public_http_url(hit_image)
    if claimed and source and _url_key(claimed) == _url_key(source):
        claimed = ""
    if claimed and not _usable_image_hint(claimed):
        claimed = ""
    if claimed and _is_rejected_image(claimed):
        claimed = ""
    if hit_image and _is_rejected_image(hit_image):
        hit_image = ""
    ordered: list[str] = []
    for url in (hit_image, claimed, source):
        url = _public_http_url(url)
        if url and url not in ordered:
            ordered.append(url)
    return ordered


def attach_candidate_images(
    candidates: Sequence[ProductImageCandidate],
    hits: Sequence[Mapping[str, str]],
) -> list[ProductImageCandidate]:
    """Keep only URLs that resolve to a photo, never a product HTML page."""

    by_url = {
        _url_key(str(hit.get("url") or "")): _public_http_url(hit.get("image"))
        for hit in hits
        if hit.get("url")
    }
    choices = [
        _image_candidates_for(candidate, by_url.get(_url_key(candidate.source_url), ""))
        for candidate in candidates
    ]
    resolved = [""] * len(candidates)
    attempts = max((len(item) for item in choices), default=0)
    for attempt in range(attempts):
        indexes = [
            index
            for index, urls in enumerate(choices)
            if not resolved[index] and attempt < len(urls)
        ]
        if not indexes:
            break
        with ThreadPoolExecutor(max_workers=min(5, len(indexes))) as pool:
            found = list(
                pool.map(
                    lambda item: page_image_url(item[0], item[1]),
                    [(choices[index][attempt], candidates[index].name) for index in indexes],
                )
            )
        for index, image in zip(indexes, found, strict=True):
            resolved[index] = image
    attached = [
        replace(candidate, image_url=image) if image else replace(candidate, image_url="")
        for candidate, image in zip(candidates, resolved, strict=True)
    ]
    with_photo = sum(1 for item in attached if item.image_url)
    logger.info(
        "image_search photos attached=%s missing=%s",
        with_photo,
        len(attached) - with_photo,
        extra={"step": "images", "candidates": with_photo, "hits": len(hits)},
    )
    return attached


def _clean_name(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    name = " ".join(value.split())
    return name[:MAX_NAME_LENGTH]


def map_candidate_attributes(
    schema: Sequence[CustomFieldDefinition],
    values: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """Keep only keys that belong to this store and survive field-type cleaning.

    Missing required columns are left out on purpose: the form still asks for
    them when the seller saves.
    """

    submitted = values if isinstance(values, Mapping) else {}
    stored: dict[str, Any] = {}
    by_key = {definition.key: definition for definition in schema if definition.is_active}
    for key, raw in submitted.items():
        definition = by_key.get(str(key))
        if definition is None or _blank(raw):
            continue
        try:
            stored[definition.key] = clean_value(definition, raw)
        except DomainError:
            continue
    return stored


def _candidates_from_hits(
    hits: Sequence[Mapping[str, str]],
    schema: Sequence[CustomFieldDefinition],
) -> list[ProductImageCandidate]:
    """Build drafts from search results when the VLM extract step is unavailable."""

    candidates: list[ProductImageCandidate] = []
    for index, item in enumerate(hits):
        built = _candidate_from_raw(
            {
                "name": item.get("title"),
                "sourceUrl": item.get("url"),
                "imageUrl": item.get("image"),
                "confidence": max(0.35, 0.55 - (index * 0.04)),
            },
            schema,
        )
        if built is not None:
            candidates.append(built)
        if len(candidates) >= MAX_CANDIDATES:
            break
    return candidates


def _candidate_from_raw(
    raw: Mapping[str, Any],
    schema: Sequence[CustomFieldDefinition],
) -> ProductImageCandidate | None:
    name = _clean_name(raw.get("name") or raw.get("title"))
    if not name:
        return None
    extras = raw.get("extraAttributes")
    if extras is None:
        extras = raw.get("extra_attributes")
    return ProductImageCandidate(
        name=name,
        sale_price=_clean_suggested_price(raw.get("salePrice", raw.get("sale_price"))),
        purchase_price=_clean_suggested_price(raw.get("purchasePrice", raw.get("purchase_price"))),
        extra_attributes=map_candidate_attributes(
            schema,
            extras if isinstance(extras, Mapping) else {},
        ),
        source_url=_clean_url(raw.get("sourceUrl", raw.get("source_url"))),
        image_url=_clean_url(raw.get("imageUrl", raw.get("image_url"))),
        confidence=_clean_confidence(raw.get("confidence")),
    )


def _schema_prompt(schema: Sequence[CustomFieldDefinition]) -> str:
    if not schema:
        return "Esta tienda no tiene columnas extra. extraAttributes debe ser {}."
    lines = [
        "Columnas extra de ESTA tienda. No inventes otras claves.",
        "single_select solo con una option.key de la lista. boolean true/false.",
        "Si no hay evidencia, omite la clave.",
    ]
    for definition in schema:
        options = ""
        if definition.field_type == CustomFieldDefinition.FieldType.SINGLE_SELECT:
            keys = ", ".join(definition.option_keys) or "(sin opciones)"
            options = f" opciones=[{keys}]"
        required = "obligatorio" if definition.is_required else "opcional"
        lines.append(
            f"- {definition.key} | {definition.label} | "
            f"{definition.field_type} | {required}{options}"
        )
    return "\n".join(lines)


_FAKE_TEMPLATES: tuple[dict[str, Any], ...] = (
    {
        "name": "Vela de soya aroma lavanda",
        "sale_price": 12990,
        "purchase_price": 4500,
        "source_url": "https://example.com/productos/vela-lavanda",
        "image_url": "https://example.com/img/vela-lavanda.jpg",
        "confidence": 0.92,
    },
    {
        "name": "Set de velas artesanales",
        "sale_price": 15990,
        "purchase_price": 5200,
        "source_url": "https://example.com/productos/set-velas",
        "image_url": "https://example.com/img/set-velas.jpg",
        "confidence": 0.84,
    },
    {
        "name": "Vela de cera de soya 200 g",
        "sale_price": 9990,
        "purchase_price": 3800,
        "source_url": "https://example.com/productos/vela-200g",
        "image_url": "https://example.com/img/vela-200g.jpg",
        "confidence": 0.77,
    },
    {
        "name": "Difusor de aromas con palitos",
        "sale_price": 18990,
        "purchase_price": 6100,
        "source_url": "https://example.com/productos/difusor",
        "image_url": "https://example.com/img/difusor.jpg",
        "confidence": 0.71,
    },
    {
        "name": "Pack vela + fósforos",
        "sale_price": 7990,
        "purchase_price": 2900,
        "source_url": "https://example.com/productos/pack-vela",
        "image_url": "https://example.com/img/pack-vela.jpg",
        "confidence": 0.64,
    },
)


def _fake_value_for_field(definition: CustomFieldDefinition, index: int) -> Any:
    field_type = definition.field_type
    if field_type == CustomFieldDefinition.FieldType.SHORT_TEXT:
        return f"Muestra {index + 1}"
    if field_type == CustomFieldDefinition.FieldType.DECIMAL:
        return f"{10 + index}.5"
    if field_type == CustomFieldDefinition.FieldType.DATE:
        return "2026-03-15"
    if field_type == CustomFieldDefinition.FieldType.BOOLEAN:
        return index % 2 == 0
    if field_type == CustomFieldDefinition.FieldType.SINGLE_SELECT:
        keys = definition.option_keys
        return keys[index % len(keys)] if keys else None
    return None


class FakeImageSearchProvider:
    """Stable 4-candidate catalogue so tests never hit the network."""

    def suggest(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
        schema: Sequence[CustomFieldDefinition],
    ) -> list[ProductImageCandidate]:
        del content_type
        digest = hashlib.sha256(image_bytes or b"empty").hexdigest()
        offset = int(digest[:8], 16) % len(_FAKE_TEMPLATES)
        candidates: list[ProductImageCandidate] = []
        for step in range(4):
            template = _FAKE_TEMPLATES[(offset + step) % len(_FAKE_TEMPLATES)]
            extras = {
                definition.key: _fake_value_for_field(definition, step)
                for definition in schema
                if definition.is_active
            }
            extras = {key: value for key, value in extras.items() if value is not None}
            built = _candidate_from_raw({**template, "extraAttributes": extras}, schema)
            if built is not None:
                candidates.append(built)
        return candidates


def _strip_tags(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value)
    return html.unescape(re.sub(r"\s+", " ", text)).strip()


def _unwrap_ddg_url(href: str) -> str:
    parsed = urlparse(html.unescape(href))
    if "duckduckgo.com" in parsed.netloc and parsed.path.startswith("/l/"):
        target = parse_qs(parsed.query).get("uddg", [""])[0]
        return unquote(target)
    return html.unescape(href)


def _localize_search_queries(queries: Sequence[Any]) -> list[str]:
    """Prefer Chilean retailers we can scrape for a real product photo."""

    cleaned = [str(item).strip() for item in queries if str(item).strip()]
    if not cleaned:
        return []
    primary = cleaned[0]
    if "falabella" in primary.lower():
        return cleaned[:2]
    scoped = [f"{primary} falabella chile"]
    secondary = cleaned[1] if len(cleaned) > 1 else primary
    if secondary.lower() != scoped[0].lower():
        scoped.append(secondary)
    return scoped[:2]


def search_web(queries: Sequence[str]) -> list[dict[str, str]]:
    """Brave when a key exists; otherwise DuckDuckGo HTML for local only."""

    cleaned = [query.strip() for query in queries if query and query.strip()]
    if not cleaned:
        return []
    brave_key = str(getattr(settings, "BRAVE_SEARCH_API_KEY", "") or "").strip()
    if brave_key:
        return _search_brave(cleaned, brave_key)
    return _search_duckduckgo(cleaned)


def _search_brave(queries: Sequence[str], api_key: str) -> list[dict[str, str]]:
    hits: list[dict[str, str]] = []
    seen: set[str] = set()
    try:
        with httpx.Client(timeout=SEARCH_TIMEOUT_SECONDS) as client:
            for query in queries[:3]:
                response = client.get(
                    BRAVE_SEARCH_URL,
                    params={"q": query, "count": 6, "country": "CL", "search_lang": "es"},
                    headers={
                        "Accept": "application/json",
                        "X-Subscription-Token": api_key,
                    },
                )
                response.raise_for_status()
                payload = response.json()
                for item in (payload.get("web") or {}).get("results") or []:
                    url = str(item.get("url") or "").strip()
                    if not url or url in seen:
                        continue
                    seen.add(url)
                    thumbnail = item.get("thumbnail")
                    image = ""
                    if isinstance(thumbnail, Mapping):
                        image = _public_http_url(thumbnail.get("src") or thumbnail.get("url"))
                    elif isinstance(thumbnail, str):
                        image = _public_http_url(thumbnail)
                    if not image:
                        image = _public_http_url(item.get("image"))
                    hits.append(
                        {
                            "title": str(item.get("title") or ""),
                            "url": url,
                            "snippet": str(item.get("description") or ""),
                            "image": image,
                        }
                    )
                if len(hits) >= 8:
                    break
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        logger.warning("brave_search_failed", extra={"error": str(exc)})
    return hits[:8]


def _search_duckduckgo(queries: Sequence[str]) -> list[dict[str, str]]:
    hits: list[dict[str, str]] = []
    seen: set[str] = set()
    try:
        with httpx.Client(
            timeout=SEARCH_TIMEOUT_SECONDS,
            headers={"User-Agent": "TendaInventory/1.0"},
            follow_redirects=True,
        ) as client:
            for query in queries[:2]:
                response = client.post(
                    DUCKDUCKGO_HTML_URL,
                    data={"q": query, "kl": "cl-es"},
                )
                response.raise_for_status()
                links = _RESULT_LINK.findall(response.text)
                if not links:
                    logger.warning(
                        "duckduckgo_empty_results html_length=%s",
                        len(response.text),
                        extra={"step": "web_search", "hits": 0, "statusCode": response.status_code},
                    )
                snippets = [_strip_tags(item) for item in _RESULT_SNIPPET.findall(response.text)]
                for index, (href, title_html) in enumerate(links):
                    url = _unwrap_ddg_url(href)
                    if not url.startswith("http") or url in seen:
                        continue
                    seen.add(url)
                    hits.append(
                        {
                            "title": _strip_tags(title_html),
                            "url": url,
                            "snippet": snippets[index] if index < len(snippets) else "",
                            "image": "",
                        }
                    )
                if len(hits) >= 8:
                    break
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        logger.warning("duckduckgo_search_failed", extra={"error": str(exc)})
    return hits[:8]


def _extract_json(text: str) -> Any:
    if not text:
        return None
    block = _JSON_BLOCK.search(text)
    raw = block.group(1) if block else None
    if raw is None:
        match = _JSON_OBJECT.search(text)
        raw = match.group(0) if match else None
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


class NvidiaImageSearchProvider:
    def suggest(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
        schema: Sequence[CustomFieldDefinition],
    ) -> list[ProductImageCandidate]:
        api_key = str(getattr(settings, "NVIDIA_API_KEY", "") or "").strip()
        if not api_key:
            raise DomainError(
                "PRODUCT_IMAGE_SEARCH_NOT_CONFIGURED",
                "La búsqueda por imagen no está configurada.",
                status=503,
            )
        description = self._describe(image_bytes, content_type or "image/jpeg", api_key)
        queries = description.get("queries") or []
        if isinstance(queries, str):
            queries = [queries]
        if not queries and description.get("summary"):
            queries = [str(description["summary"])]
        queries = _localize_search_queries(queries)
        logger.info(
            "image_search described queries=%s",
            len(queries),
            extra={"step": "describe", "hits": len(queries)},
        )
        hits = search_web(queries)
        logger.info(
            "image_search web_hits=%s",
            len(hits),
            extra={"step": "web_search", "hits": len(hits)},
        )
        extracted = self._extract_candidates(description, hits, schema, api_key)
        candidates = [
            built
            for item in extracted
            if isinstance(item, Mapping)
            for built in [_candidate_from_raw(item, schema)]
            if built is not None
        ]
        logger.info(
            "image_search extracted raw=%s mapped=%s",
            len(extracted),
            len(candidates),
            extra={"step": "extract", "candidates": len(candidates), "hits": len(extracted)},
        )
        if not candidates:
            candidates = _candidates_from_hits(hits, schema)
            logger.info(
                "image_search extract_fallback mapped=%s",
                len(candidates),
                extra={
                    "step": "extract_fallback",
                    "candidates": len(candidates),
                    "hits": len(hits),
                },
            )
        if not candidates:
            raise DomainError(
                "PRODUCT_IMAGE_SEARCH_EMPTY",
                "No encontramos productos similares. Completa la ficha a mano.",
                status=422,
            )
        return attach_candidate_images(candidates[:MAX_CANDIDATES], hits)

    def _chat(
        self,
        api_key: str,
        messages: list[dict[str, Any]],
        *,
        timeout: float,
        step: str,
    ) -> str:
        model = str(
            getattr(settings, "NVIDIA_VISION_MODEL", "") or "meta/llama-3.2-11b-vision-instruct"
        )
        try:
            response = httpx.post(
                NVIDIA_CHAT_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": 900,
                },
                timeout=timeout,
            )
            response.raise_for_status()
            payload = response.json()
            choices = payload.get("choices") if isinstance(payload, Mapping) else None
            if not isinstance(choices, list) or not choices:
                raise ValueError(f"nvidia_empty_choices keys={list(payload)}")
            message = choices[0].get("message") if isinstance(choices[0], Mapping) else None
            if not isinstance(message, Mapping):
                raise ValueError("nvidia_missing_message")
            content = message.get("content")
            if not content:
                raise ValueError(f"nvidia_empty_content finish={choices[0].get('finish_reason')}")
            return str(content)
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            logger.warning(
                "nvidia_vision_failed step=%s error=%s:%s status=%s",
                step,
                type(exc).__name__,
                exc,
                status_code,
                extra={
                    "step": step,
                    "error": f"{type(exc).__name__}: {exc}",
                    "statusCode": status_code,
                },
            )
            raise DomainError(
                "PRODUCT_IMAGE_SEARCH_FAILED",
                "No pudimos analizar la foto. Completa la ficha a mano.",
                status=503,
                retryable=True,
            ) from exc

    def _describe(self, image_bytes: bytes, content_type: str, api_key: str) -> dict[str, Any]:
        encoded = base64.b64encode(image_bytes).decode("ascii")
        prompt = (
            "Describe el producto de la foto para buscarlo en internet. "
            "Responde SOLO JSON: "
            '{"summary":"...", "queries":["query en español","query en inglés"]} '
            "Máximo 3 queries cortas, concretas (tipo de producto, marca si se ve, material)."
        )
        content = self._chat(
            api_key,
            [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{content_type};base64,{encoded}"},
                        },
                    ],
                }
            ],
            timeout=VISION_TIMEOUT_SECONDS,
            step="describe",
        )
        parsed = _extract_json(content)
        if isinstance(parsed, Mapping):
            return dict(parsed)
        logger.warning(
            "image_search describe_unparsed preview=%s",
            content.strip()[:160],
            extra={"step": "describe", "error": "unparsed_json"},
        )
        return {"summary": content.strip()[:400], "queries": [content.strip()[:80]]}

    def _extract_candidates(
        self,
        description: Mapping[str, Any],
        hits: Sequence[Mapping[str, str]],
        schema: Sequence[CustomFieldDefinition],
        api_key: str,
    ) -> list[Any]:
        results = (
            "\n".join(
                f"- {item.get('title', '')} | {item.get('url', '')} | {item.get('snippet', '')}"
                for item in list(hits)[:MAX_CANDIDATES]
            )
            or "(sin resultados de búsqueda)"
        )
        prompt = (
            "A partir de la descripción de una foto y resultados de internet, "
            "propón entre 3 y 5 productos candidatos para un inventario chileno.\n"
            "Responde SOLO JSON: "
            '{"candidates":[{"name":"","salePrice":null,"purchasePrice":null,'
            '"extraAttributes":{},"sourceUrl":"","imageUrl":"","confidence":0.0}]}\n'
            "salePrice y purchasePrice son enteros CLP o null. No inventes precios sin evidencia.\n"
            "sourceUrl e imageUrl salen de los resultados. No copies la foto del vendedor.\n"
            f"{_schema_prompt(schema)}\n\n"
            f"Descripción: {json.dumps(description, ensure_ascii=False)}\n"
            f"Resultados:\n{results}"
        )
        try:
            content = self._chat(
                api_key,
                [{"role": "user", "content": prompt}],
                timeout=EXTRACT_TIMEOUT_SECONDS,
                step="extract",
            )
        except DomainError:
            return []
        parsed = _extract_json(content)
        if isinstance(parsed, Mapping) and isinstance(parsed.get("candidates"), list):
            return list(parsed["candidates"])
        if isinstance(parsed, list):
            return parsed
        logger.warning(
            "image_search extract_unparsed preview=%s",
            content.strip()[:160],
            extra={"step": "extract", "error": "unparsed_json", "candidates": 0},
        )
        return []


fake_image_search_provider = FakeImageSearchProvider()


def get_image_search_provider() -> ProductImageSearchProvider:
    name = str(getattr(settings, "PRODUCT_IMAGE_SEARCH_PROVIDER", "fake") or "fake").strip()
    if name == "fake":
        return fake_image_search_provider
    if name == "nvidia":
        return NvidiaImageSearchProvider()
    raise DomainError(
        "PRODUCT_IMAGE_SEARCH_NOT_CONFIGURED",
        "El proveedor de búsqueda por imagen no es válido.",
        status=503,
    )


def _candidates_from_payload(payload: Mapping[str, Any]) -> list[ProductImageCandidate]:
    items = payload.get("candidates")
    if not isinstance(items, list):
        return []
    candidates: list[ProductImageCandidate] = []
    for item in items:
        if not isinstance(item, Mapping):
            continue
        built = _candidate_from_raw(
            {
                "name": item.get("name"),
                "salePrice": item.get("salePrice"),
                "purchasePrice": item.get("purchasePrice"),
                "extraAttributes": item.get("extraAttributes") or {},
                "sourceUrl": item.get("sourceUrl") or "",
                "imageUrl": item.get("imageUrl") or "",
                "confidence": item.get("confidence"),
            },
            [],
        )
        if built is None:
            continue
        extras = item.get("extraAttributes")
        candidates.append(
            ProductImageCandidate(
                name=built.name,
                sale_price=built.sale_price,
                purchase_price=built.purchase_price,
                extra_attributes=dict(extras) if isinstance(extras, Mapping) else {},
                source_url=built.source_url,
                image_url=built.image_url,
                confidence=built.confidence,
            )
        )
    return candidates


def suggest_products_from_image(
    *,
    context: TenantContext,
    asset_id: object,
    idempotency_key: str,
) -> SuggestedProducts:
    from apps.billing.entitlements import assert_ai_assisted_allowed

    assert_ai_assisted_allowed(context.organisation)
    try:
        public_id = asset_id if isinstance(asset_id, uuid.UUID) else uuid.UUID(str(asset_id))
    except (TypeError, ValueError) as exc:
        raise DomainError("NOT_FOUND", "No encontramos el recurso solicitado.", status=404) from exc

    asset = ready_asset(
        context=context,
        public_id=public_id,
        purpose=MediaAsset.Purpose.PRODUCT_IMAGE,
    )
    provider = get_image_search_provider()

    def command() -> tuple[dict[str, Any], int]:
        _ready, content = read_ready_asset(context=context, public_id=asset.public_id)
        schema = list(active_custom_fields(context))
        suggested = provider.suggest(
            image_bytes=content,
            content_type=asset.content_type or "image/jpeg",
            schema=schema,
        )
        trimmed = suggested[:MAX_CANDIDATES]
        if len(trimmed) < MIN_CANDIDATES:
            logger.warning(
                "image_search below_minimum candidates=%s",
                len(trimmed),
                extra={"step": "suggest", "candidates": len(trimmed)},
            )
            raise DomainError(
                "PRODUCT_IMAGE_SEARCH_EMPTY",
                "No encontramos productos similares. Completa la ficha a mano.",
                status=422,
            )
        return {"candidates": [item.as_payload() for item in trimmed]}, 200

    outcome = execute_idempotent(
        context=context,
        scope="inventory.suggest_products_from_image",
        key=idempotency_key,
        request_payload={"assetId": str(asset.public_id)},
        command=command,
    )
    return SuggestedProducts(
        candidates=_candidates_from_payload(outcome.payload),
        replayed=outcome.replayed,
    )
