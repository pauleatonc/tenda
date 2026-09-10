from django.urls import path

from . import api

app_name = "sales-public"

urlpatterns = [
    path(
        "orders/<str:token>/payment-proof/uploads/prepare",
        api.prepare_public_receipt,
        name="prepare-receipt",
    ),
    path(
        "orders/<str:token>/payment-proof/uploads/fake/<str:asset_id>",
        api.fake_public_receipt,
        name="fake-receipt",
    ),
    path(
        "orders/<str:token>/payment-proof/uploads/complete",
        api.complete_public_receipt,
        name="complete-receipt",
    ),
    path(
        "orders/<str:token>/media/<str:asset_id>",
        api.public_order_media,
        name="order-media",
    ),
]
