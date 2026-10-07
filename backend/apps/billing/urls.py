from django.urls import path

from . import api

app_name = "billing-webhooks"

urlpatterns = [
    path(
        "mercado-pago-billing",
        api.mercado_pago_billing_webhook,
        name="mercado-pago-billing",
    ),
]
