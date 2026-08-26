from django.urls import path

from . import api

app_name = "shipping-public"

urlpatterns = [
    path(
        "shipments/<str:token>/confirm",
        api.confirm_public_shipment_view,
        name="confirm-shipment",
    ),
]
