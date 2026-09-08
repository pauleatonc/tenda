from django.urls import path

from . import api

app_name = "media-assets"

urlpatterns = [
    path("uploads/prepare", api.prepare_upload_view, name="prepare-upload"),
    path("uploads/fake/<str:asset_id>", api.fake_upload_view, name="fake-upload"),
    path("uploads/complete", api.complete_upload_view, name="complete-upload"),
    path("<str:asset_id>/download", api.download_view, name="download"),
    path("<str:asset_id>/content", api.content_view, name="content"),
]
