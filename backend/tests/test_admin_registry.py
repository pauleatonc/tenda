from __future__ import annotations

import pytest
from django.apps import apps
from django.contrib import admin
from django.test import Client, override_settings

from apps.inventory.models import Product
from apps.organisations.services import create_organisation_for_owner
from apps.users.models import Profile, User

pytestmark = pytest.mark.django_db(transaction=True)

LOCAL_APP_LABELS = {
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

TEST_STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}


def test_every_local_model_is_registered_in_admin() -> None:
    missing = [
        f"{model._meta.app_label}.{model.__name__}"
        for model in apps.get_models()
        if model._meta.app_label in LOCAL_APP_LABELS
        and not model._meta.abstract
        and model not in admin.site._registry
    ]
    assert missing == []


@override_settings(STORAGES=TEST_STORAGES)
def test_admin_maintainer_can_create_users_and_catalogue() -> None:
    staff = User.objects.create_superuser(
        email="ops@tenda.test",
        password="Correct-Horse-Battery-42",
    )
    provision = create_organisation_for_owner(owner=staff, name="Ops Tenda")
    client = Client()
    client.force_login(staff)

    index = client.get("/admin/")
    assert index.status_code == 200
    assert "Mantenedor general" in index.content.decode()

    created = client.post(
        "/admin/users/user/add/",
        {
            "email": "keeper@tenda.test",
            "password": "Correct-Horse-Battery-42",
            "is_active": "on",
            "is_staff": "on",
            "session_version": "1",
        },
        follow=True,
    )
    assert created.status_code == 200
    keeper = User.objects.get(email="keeper@tenda.test")
    assert keeper.check_password("Correct-Horse-Battery-42")
    assert keeper.is_staff
    assert Profile.objects.filter(user=keeper).exists()

    add_product = client.get("/admin/inventory/product/add/")
    assert add_product.status_code == 200

    saved = client.post(
        "/admin/inventory/product/add/",
        {
            "inventory": str(provision.inventory.pk),
            "name": "Vela mantenedor",
            "catalog_status": Product.CatalogStatus.ACTIVE,
            "currency": "CLP",
            "media_attachments-TOTAL_FORMS": "0",
            "media_attachments-INITIAL_FORMS": "0",
            "media_attachments-MIN_NUM_FORMS": "0",
            "media_attachments-MAX_NUM_FORMS": "1000",
        },
        follow=True,
    )
    assert saved.status_code == 200
    product = Product.objects.get(name="Vela mantenedor")
    change = client.get(f"/admin/inventory/product/{product.pk}/change/")
    assert change.status_code == 200
    page = add_product.content.decode()
    assert "Agregar producto" in page or "Añadir" in page

    order_add = client.get("/admin/sales/order/add/")
    assert order_add.status_code == 200
    assert "public_token_ciphertext" not in order_add.content.decode()
    assert "public_token_hash" not in order_add.content.decode()
