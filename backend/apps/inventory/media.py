"""Product gallery commands over tenant-private MediaAsset objects."""

from __future__ import annotations

import uuid

from django.db import transaction
from django.db.models import Max, QuerySet

from apps.audit.services import record_audit_event
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import delete_stored_objects, stored_object_keys
from apps.organisations.selectors import TenantContext
from tenda.errors import DomainError, ResourceNotFound

from .models import Product, ProductMediaAttachment
from .selectors import product_for_context

MAX_PRODUCT_IMAGES = 10


def product_media(
    context: TenantContext,
    *,
    product: Product,
) -> QuerySet[ProductMediaAttachment]:
    if product.inventory_id != context.inventory.id:
        raise ResourceNotFound()
    return ProductMediaAttachment.objects.filter(product=product).select_related("asset", "product")


@transaction.atomic
def attach_product_media(
    *,
    context: TenantContext,
    product_id: uuid.UUID,
    asset_id: uuid.UUID,
    make_primary: bool = False,
    correlation_id: str = "",
) -> ProductMediaAttachment:
    product = product_for_context(context, product_id)
    product = Product.objects.select_for_update().get(pk=product.pk)
    if product.is_archived:
        raise DomainError(
            "PRODUCT_ARCHIVED",
            "Reactiva el producto antes de agregar fotos.",
            status=409,
        )
    asset = (
        MediaAsset.objects.select_for_update()
        .filter(
            public_id=asset_id,
            organisation=context.organisation,
            purpose=MediaAsset.Purpose.PRODUCT_IMAGE,
            status=MediaAsset.Status.READY,
        )
        .first()
    )
    if asset is None:
        raise ResourceNotFound()
    existing = ProductMediaAttachment.objects.filter(asset=asset).first()
    if existing is not None:
        if existing.product_id != product.id:
            raise DomainError(
                "MEDIA_ALREADY_ATTACHED",
                "La foto ya está asociada a otro producto.",
                status=409,
            )
        if make_primary and product.primary_image_id != asset.id:
            product.primary_image = asset
            product.save(update_fields=("primary_image", "updated_at"))
        return existing
    if ProductMediaAttachment.objects.filter(product=product).count() >= MAX_PRODUCT_IMAGES:
        raise DomainError(
            "PRODUCT_MEDIA_LIMIT_REACHED",
            f"Cada producto admite hasta {MAX_PRODUCT_IMAGES} fotos.",
            status=409,
        )
    last_position = (
        ProductMediaAttachment.objects.filter(product=product).aggregate(maximum=Max("position"))[
            "maximum"
        ]
        or 0
    )
    attachment = ProductMediaAttachment.objects.create(
        product=product,
        asset=asset,
        attached_by=context.user,
        position=int(last_position) + 1,
    )
    if make_primary or product.primary_image_id is None:
        product.primary_image = asset
        product.save(update_fields=("primary_image", "updated_at"))
    record_audit_event(
        action="inventory.product_media_attached",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.product",
        object_public_id=str(product.public_id),
        correlation_id=correlation_id,
        metadata={"assetId": str(asset.public_id), "primary": product.primary_image_id == asset.id},
    )
    return attachment


@transaction.atomic
def set_primary_product_media(
    *,
    context: TenantContext,
    product_id: uuid.UUID,
    asset_id: uuid.UUID,
    correlation_id: str = "",
) -> ProductMediaAttachment:
    product = product_for_context(context, product_id)
    product = Product.objects.select_for_update().get(pk=product.pk)
    attachment = (
        ProductMediaAttachment.objects.select_related("asset")
        .filter(
            product=product,
            asset__public_id=asset_id,
            asset__organisation=context.organisation,
        )
        .first()
    )
    if attachment is None:
        raise ResourceNotFound()
    product.primary_image = attachment.asset
    product.save(update_fields=("primary_image", "updated_at"))
    record_audit_event(
        action="inventory.product_primary_media_updated",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.product",
        object_public_id=str(product.public_id),
        correlation_id=correlation_id,
        metadata={"assetId": str(attachment.asset.public_id)},
    )
    return attachment


@transaction.atomic
def remove_product_media(
    *,
    context: TenantContext,
    product_id: uuid.UUID,
    asset_id: uuid.UUID,
    correlation_id: str = "",
) -> Product:
    product = product_for_context(context, product_id)
    product = Product.objects.select_for_update().get(pk=product.pk)
    attachment = (
        ProductMediaAttachment.objects.select_for_update()
        .select_related("asset")
        .filter(
            product=product,
            asset__public_id=asset_id,
            asset__organisation=context.organisation,
        )
        .first()
    )
    if attachment is None:
        raise ResourceNotFound()
    asset = attachment.asset
    if product.primary_image_id == asset.id:
        replacement = (
            ProductMediaAttachment.objects.filter(product=product)
            .exclude(pk=attachment.pk)
            .select_related("asset")
            .order_by("position", "created_at")
            .first()
        )
        product.primary_image = replacement.asset if replacement else None
        product.save(update_fields=("primary_image", "updated_at"))
    attachment.delete()
    keys = stored_object_keys(asset)
    asset.delete()
    transaction.on_commit(lambda: delete_stored_objects(keys))
    record_audit_event(
        action="inventory.product_media_removed",
        organisation=context.organisation,
        actor=context.user,
        object_type="inventory.product",
        object_public_id=str(product.public_id),
        correlation_id=correlation_id,
        metadata={"assetId": str(asset_id)},
    )
    return product
