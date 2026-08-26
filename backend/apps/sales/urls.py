from django.urls import path

from . import api

app_name = "sales-webhooks"

urlpatterns = [
    path("mercado-pago", api.mercado_pago_webhook, name="mercado-pago"),
]
