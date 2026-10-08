from __future__ import annotations

import io
import json
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone
from PIL import Image

from apps.billing.models import OrganisationSubscription, Plan
from apps.inventory.custom_fields import validate_extra_attributes
from apps.inventory.image_search import (
    FakeImageSearchProvider,
    NvidiaImageSearchProvider,
    ProductImageCandidate,
    _best_image_from_html,
    _localize_search_queries,
    attach_candidate_images,
    map_candidate_attributes,
    page_image_url,
    suggest_products_from_image,
)
from apps.inventory.models import CustomFieldDefinition
from apps.inventory.selectors import active_custom_fields
from apps.inventory.services import create_custom_field
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import complete_upload, prepare_upload
from apps.media_assets.storage import fake_object_storage
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.users.models import User
from tenda.errors import DomainError

pytestmark = pytest.mark.django_db(transaction=True)

PASSWORD = "Correct-Horse-Battery-42"
SUGGEST_MUTATION = """
mutation Suggest($input: SuggestProductsFromImageInput!) {
  suggestProductsFromImage(input: $input) {
    replayed
    candidates {
      name
      salePrice
      purchasePrice
      extraAttributes
      sourceUrl
      imageUrl
      confidence
    }
  }
}
"""


def activate_paid_plan(context: TenantContext, code: str = "starter") -> None:
    plan = Plan.objects.get(code=code)
    OrganisationSubscription.objects.update_or_create(
        organisation=context.organisation,
        defaults={
            "plan": plan,
            "status": OrganisationSubscription.Status.ACTIVE,
            "mp_preapproval_id": f"test-{code}",
            "cancel_at_period_end": False,
            "past_due_since": None,
            "current_period_end": timezone.now() + timedelta(days=30),
        },
    )


def identity(email: str, *, paid: bool = False) -> tuple[User, TenantContext]:
    user = User.objects.create_user(
        email=email,
        password=PASSWORD,
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    context = resolve_tenant_context(user)
    if paid:
        activate_paid_plan(context)
    return user, context


def signed_in(email: str, *, paid: bool = False) -> tuple[Client, TenantContext]:
    user, context = identity(email, paid=paid)
    client = Client()
    login = client.post(
        "/api/v1/auth/login",
        data=json.dumps({"email": user.email, "password": PASSWORD}),
        content_type="application/json",
    )
    assert login.status_code == 200
    return client, context


def rgb_image_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (48, 48), (20, 80, 40)).save(buffer, format="PNG")
    return buffer.getvalue()


def uploaded_product_image(context: TenantContext, content: bytes | None = None) -> MediaAsset:
    payload = content if content is not None else rgb_image_bytes()
    prepared = prepare_upload(
        context=context,
        purpose=MediaAsset.Purpose.PRODUCT_IMAGE,
        original_name="producto.png",
        content_type="image/png",
        size=len(payload),
    )
    fake_object_storage.write_bytes(
        key=prepared.asset.object_key,
        content=payload,
        content_type="image/png",
    )
    return complete_upload(context=context, public_id=prepared.asset.public_id)


def store_schema(context: TenantContext) -> dict[str, CustomFieldDefinition]:
    marca = create_custom_field(
        context=context,
        label="Marca",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
    )
    talla = create_custom_field(
        context=context,
        label="Talla",
        field_type=CustomFieldDefinition.FieldType.SINGLE_SELECT,
        options=[{"key": "m", "label": "M"}, {"key": "l", "label": "L"}],
    )
    peso = create_custom_field(
        context=context,
        label="Peso",
        field_type=CustomFieldDefinition.FieldType.DECIMAL,
    )
    return {"marca": marca, "talla": talla, "peso": peso}


def test_map_candidate_attributes_keeps_only_valid_schema_keys() -> None:
    _user, context = identity("owner-map@example.com")
    fields = store_schema(context)
    create_custom_field(
        context=context,
        label="Obligatorio",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
        is_required=True,
    )
    mapped = map_candidate_attributes(
        active_custom_fields(context),
        {
            "marca": "Atelier",
            "talla": "XL",
            "peso": "no-es-numero",
            "inventada": "no",
            fields["talla"].key: "m",
        },
    )
    assert mapped["marca"] == "Atelier"
    assert mapped["talla"] == "m"
    assert "peso" not in mapped
    assert "inventada" not in mapped
    assert "obligatorio" not in mapped
    validate_extra_attributes(active_custom_fields(context), {**mapped, "obligatorio": "sí"})


def test_fake_provider_is_deterministic_and_schema_aware() -> None:
    _user, context = identity("owner-fake@example.com")
    store_schema(context)
    image = rgb_image_bytes()
    first = FakeImageSearchProvider().suggest(
        image_bytes=image,
        content_type="image/png",
        schema=list(active_custom_fields(context)),
    )
    second = FakeImageSearchProvider().suggest(
        image_bytes=image,
        content_type="image/png",
        schema=list(active_custom_fields(context)),
    )
    assert 3 <= len(first) <= 5
    assert [item.as_payload() for item in first] == [item.as_payload() for item in second]
    assert all(item.sale_price is None or isinstance(item.sale_price, int) for item in first)
    assert all("marca" in item.extra_attributes for item in first)
    assert all(item.extra_attributes["talla"] in {"m", "l"} for item in first)


def test_suggest_products_from_image_reuses_idempotency() -> None:
    fake_object_storage.clear()
    _user, context = identity("owner-idem@example.com", paid=True)
    store_schema(context)
    asset = uploaded_product_image(context)

    first = suggest_products_from_image(
        context=context,
        asset_id=asset.public_id,
        idempotency_key="suggest-1",
    )
    replay = suggest_products_from_image(
        context=context,
        asset_id=asset.public_id,
        idempotency_key="suggest-1",
    )
    assert first.replayed is False
    assert replay.replayed is True
    assert [item.as_payload() for item in first.candidates] == [
        item.as_payload() for item in replay.candidates
    ]


def test_suggest_rejects_non_product_image(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_object_storage.clear()
    _user, context = identity("owner-purpose@example.com", paid=True)
    payload = rgb_image_bytes()
    prepared = prepare_upload(
        context=context,
        purpose=MediaAsset.Purpose.PROFILE_PHOTO,
        original_name="perfil.png",
        content_type="image/png",
        size=len(payload),
    )
    fake_object_storage.write_bytes(
        key=prepared.asset.object_key,
        content=payload,
        content_type="image/png",
    )
    asset = complete_upload(context=context, public_id=prepared.asset.public_id)
    monkeypatch.setattr("django.conf.settings.PRODUCT_IMAGE_SEARCH_PROVIDER", "fake")
    with pytest.raises(DomainError) as missing:
        suggest_products_from_image(
            context=context,
            asset_id=asset.public_id,
            idempotency_key="suggest-bad",
        )
    assert missing.value.status == 404


def test_candidate_images_come_from_search_hits_or_og_image(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def inspect(url: str, query: str = "") -> str:
        if url.endswith("bolso.jpg"):
            return url
        if "falabella" in url:
            return "https://cdn.example.com/og.jpg"
        return ""

    monkeypatch.setattr("apps.inventory.image_search.page_image_url", inspect)
    candidates = [
        ProductImageCandidate(
            name="Bolso denim",
            sale_price=19990,
            purchase_price=None,
            extra_attributes={},
            source_url="https://www.mercadolibre.cl/bolso",
            image_url="",
            confidence=0.8,
        ),
        ProductImageCandidate(
            name="Tote azul",
            sale_price=None,
            purchase_price=None,
            extra_attributes={},
            source_url="https://www.falabella.com/tote",
            image_url="",
            confidence=0.7,
        ),
    ]
    attached = attach_candidate_images(
        candidates,
        [
            {
                "url": "https://www.mercadolibre.cl/bolso",
                "image": "https://http2.mlstatic.com/bolso.jpg",
            }
        ],
    )
    assert attached[0].image_url == "https://http2.mlstatic.com/bolso.jpg"
    assert attached[1].image_url == "https://cdn.example.com/og.jpg"


def test_candidate_images_drop_dead_links_and_product_pages(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def inspect(url: str, query: str = "") -> str:
        if url.endswith("/producto"):
            return "https://cdn.example.com/ficha.jpg"
        return ""

    monkeypatch.setattr("apps.inventory.image_search.page_image_url", inspect)
    attached = attach_candidate_images(
        [
            ProductImageCandidate(
                name="Bolso",
                sale_price=None,
                purchase_price=None,
                extra_attributes={},
                source_url="https://tienda.example.com/producto",
                image_url="https://tienda.example.com/producto",
                confidence=0.8,
            ),
            ProductImageCandidate(
                name="Tote",
                sale_price=None,
                purchase_price=None,
                extra_attributes={},
                source_url="https://tienda.example.com/tote",
                image_url="https://cdn.example.com/dead.jpg",
                confidence=0.7,
            ),
        ],
        [],
    )
    assert attached[0].image_url == "https://cdn.example.com/ficha.jpg"
    assert attached[1].image_url == ""


def test_page_html_prefers_product_cdn_over_store_logo() -> None:
    html = """
    <meta property="og:image" content="https://images.falabella.com/v3/assets/blt/OG_Fcom.jpg">
    <script>{"mediaUrls":["https://media.falabella.com/falabellaCL/152378481_01/public"]}</script>
    """
    assert (
        _best_image_from_html(html) == "https://media.falabella.com/falabellaCL/152378481_01/public"
    )


def test_page_html_rejects_logo_only_share_image() -> None:
    html = '<meta property="og:image" content="https://www.prada.com/images/logo-black.png">'
    assert _best_image_from_html(html) == ""


def test_page_image_searches_retailer_when_home_has_no_photo(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def inspect(url: str) -> str:
        if "search?Ntt=" in url:
            return "https://media.falabella.com/falabellaCL/1_01/public"
        return ""

    monkeypatch.setattr("apps.inventory.image_search._inspect_url_for_image", inspect)
    assert (
        page_image_url("https://www.falabella.com/falabella-cl", "Bolso azul Falabella")
        == "https://media.falabella.com/falabellaCL/1_01/public"
    )


def test_page_html_keeps_amazon_product_thumb() -> None:
    html = """
    <img src="https://m.media-amazon.com/images/G/30/gno/sprites/nav-sprite.png">
    <img src="https://m.media-amazon.com/images/I/01amEA7pPKL.png">
    <img src="//m.media-amazon.com/images/I/81muHxpu9wL._AC_SR160,134_.jpg">
    """
    assert (
        _best_image_from_html(html)
        == "https://m.media-amazon.com/images/I/81muHxpu9wL._AC_SR160,134_.jpg"
    )


def test_page_html_rejects_amazon_store_mark() -> None:
    html = (
        '<meta property="og:image" content="https://m.media-amazon.com/images/I/01amEA7pPKL.png">'
    )
    assert _best_image_from_html(html) == ""


def test_page_image_uses_falabella_when_foreign_store_blocks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def inspect(url: str) -> str:
        if "falabella.com" in url and "search?Ntt=" in url:
            return "https://media.falabella.com/falabellaCL/9_01/public"
        return ""

    monkeypatch.setattr("apps.inventory.image_search._inspect_url_for_image", inspect)
    assert (
        page_image_url("https://www.etsy.com/es/market/denim_tote_bag", "Denim tote bag")
        == "https://media.falabella.com/falabellaCL/9_01/public"
    )


def test_localize_search_queries_prefers_falabella() -> None:
    assert _localize_search_queries(["denim tote bag", "bolso denim"]) == [
        "denim tote bag falabella chile",
        "bolso denim",
    ]


def test_nvidia_extract_timeout_falls_back_to_search_hits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _user, context = identity("owner-extract-fallback@example.com")

    def chat(
        self,
        api_key: str,
        messages: list[dict[str, object]],
        *,
        timeout: float,
        step: str,
    ) -> str:
        if step == "describe":
            return '{"summary":"bolso denim","queries":["bolso denim"]}'
        raise DomainError(
            "PRODUCT_IMAGE_SEARCH_FAILED",
            "timeout",
            status=503,
            retryable=True,
        )

    monkeypatch.setattr("django.conf.settings.NVIDIA_API_KEY", "test-key")
    monkeypatch.setattr(NvidiaImageSearchProvider, "_chat", chat)
    monkeypatch.setattr(
        "apps.inventory.image_search.search_web",
        lambda _queries: [
            {
                "title": "Bolso denim ML",
                "url": "https://www.mercadolibre.cl/bolso",
                "snippet": "Bolso de mezclilla",
                "image": "https://http2.mlstatic.com/bolso.jpg",
            },
            {
                "title": "Tote azul Falabella",
                "url": "https://www.falabella.com/tote",
                "snippet": "Tote",
                "image": "",
            },
            {
                "title": "Mochila denim Paris",
                "url": "https://www.paris.cl/mochila",
                "snippet": "Mochila",
                "image": "https://cdn.paris.cl/mochila.jpg",
            },
        ],
    )
    monkeypatch.setattr(
        "apps.inventory.image_search.page_image_url",
        lambda url, query="": url if url.endswith(".jpg") else "",
    )
    suggested = NvidiaImageSearchProvider().suggest(
        image_bytes=rgb_image_bytes(),
        content_type="image/png",
        schema=list(active_custom_fields(context)),
    )
    assert [item.name for item in suggested] == [
        "Bolso denim ML",
        "Tote azul Falabella",
        "Mochila denim Paris",
    ]
    assert suggested[0].image_url == "https://http2.mlstatic.com/bolso.jpg"
    assert suggested[1].image_url == ""


def test_nvidia_without_key_is_a_configuration_error(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_object_storage.clear()
    _user, context = identity("owner-nvidia@example.com", paid=True)
    asset = uploaded_product_image(context)
    monkeypatch.setattr("django.conf.settings.PRODUCT_IMAGE_SEARCH_PROVIDER", "nvidia")
    monkeypatch.setattr("django.conf.settings.NVIDIA_API_KEY", "")
    with pytest.raises(DomainError) as missing:
        suggest_products_from_image(
            context=context,
            asset_id=asset.public_id,
            idempotency_key="suggest-nvidia",
        )
    assert missing.value.code == "PRODUCT_IMAGE_SEARCH_NOT_CONFIGURED"


def test_graphql_suggests_candidates_from_a_ready_photo() -> None:
    fake_object_storage.clear()
    client, context = signed_in("owner-gql@example.com", paid=True)
    store_schema(context)
    asset = uploaded_product_image(context)
    response = client.post(
        "/graphql/",
        data=json.dumps(
            {
                "query": SUGGEST_MUTATION,
                "variables": {
                    "input": {
                        "assetId": str(asset.public_id),
                        "idempotencyKey": "gql-suggest-1",
                    }
                },
            }
        ),
        content_type="application/json",
    )
    payload = response.json()
    assert "errors" not in payload, payload.get("errors")
    body = payload["data"]["suggestProductsFromImage"]
    assert body["replayed"] is False
    assert 3 <= len(body["candidates"]) <= 5
    first = body["candidates"][0]
    assert first["name"]
    extras = first["extraAttributes"]
    if isinstance(extras, str):
        extras = json.loads(extras)
    assert extras["marca"]
    assert extras["talla"] in {"m", "l"}
