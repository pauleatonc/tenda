"""HTTP routes for Tenda."""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path

from apps.notifications.api import contact
from apps.sales.api import public_order_page
from tenda.admin import configure_admin_site
from tenda.graphql_validation import QueryBudgetRule
from tenda.graphql_view import TendaGraphQLView
from tenda.health import live, ready

configure_admin_site()

urlpatterns = [
    path(settings.ADMIN_URL_PATH, admin.site.urls),
    path(
        "graphql/",
        TendaGraphQLView.as_view(
            graphiql=settings.DEBUG,
            validation_rules=[QueryBudgetRule],
        ),
        name="graphql",
    ),
    path("api/v1/auth/", include("apps.users.urls")),
    path("api/v1/integrations/", include("apps.sales.integration_urls")),
    path("api/v1/media/", include("apps.media_assets.urls")),
    path("api/v1/public/contact", contact, name="public-contact"),
    path("api/v1/public/", include("apps.sales.public_urls")),
    path("api/v1/webhooks/", include("apps.sales.urls")),
    path("p/<str:token>", public_order_page, name="public-order"),
    path("health/live/", live, name="health-live"),
    path("health/ready/", ready, name="health-ready"),
]
