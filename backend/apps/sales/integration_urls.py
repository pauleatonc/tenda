from django.urls import path

from . import api

app_name = "sales-integrations"

urlpatterns = [
    path(
        "mercado-pago/callback",
        api.mercado_pago_oauth_callback,
        name="mercado-pago-callback",
    ),
]
