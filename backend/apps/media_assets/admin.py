"""Private media metadata administration."""

from django.contrib import admin

from apps.media_assets.models import MediaAsset
from tenda.admin import MaintainerModelAdmin


@admin.register(MediaAsset)
class MediaAssetAdmin(MaintainerModelAdmin):
    list_display = (
        "original_name",
        "purpose",
        "status",
        "organisation",
        "created_at",
    )
    list_filter = ("purpose", "status", "content_type")
    search_fields = ("public_id", "original_name", "object_key", "organisation__name")
    autocomplete_fields = ("organisation", "created_by")
