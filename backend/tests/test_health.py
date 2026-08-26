import pytest
from django.apps import apps
from django.test import Client, override_settings


def test_live_health() -> None:
    response = Client().get("/health/live/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
@override_settings(REDIS_URL="")
def test_ready_health_with_database() -> None:
    response = Client().get("/health/ready/")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "checks": {"database": True},
    }


def test_graphql_health_query() -> None:
    response = Client().get("/graphql/", {"query": "{ health }"})

    assert response.status_code == 200
    assert response.json() == {"data": {"health": "ok"}}


def test_required_baseline_apps_are_registered() -> None:
    required_labels = {
        "users",
        "organisations",
        "configuration",
        "audit",
        "media_assets",
        "notifications",
        "inventory",
        "sales",
        "shipping",
    }

    assert required_labels <= {config.label for config in apps.get_app_configs()}
