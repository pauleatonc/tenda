from __future__ import annotations

import json
from typing import Any

import pytest
from django.test import Client
from django.utils import timezone

from apps.inventory.models import CustomFieldDefinition, Product, StockMovement
from apps.inventory.services import create_custom_field, create_product
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.users.models import User

pytestmark = pytest.mark.django_db(transaction=True)

PASSWORD = "Correct-Horse-Battery-42"


def identity(email: str) -> tuple[User, TenantContext]:
    user = User.objects.create_user(
        email=email,
        password=PASSWORD,
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    return user, resolve_tenant_context(user)


def signed_in(email: str) -> tuple[Client, TenantContext]:
    user, context = identity(email)
    client = Client()
    login = client.post(
        "/api/v1/auth/login",
        data=json.dumps({"email": user.email, "password": PASSWORD}),
        content_type="application/json",
    )
    assert login.status_code == 200
    return client, context


def graphql(client: Client, query: str, **variables: Any) -> dict[str, Any]:
    response = client.post(
        "/graphql/",
        data=json.dumps({"query": query, "variables": variables}),
        content_type="application/json",
    )
    payload: dict[str, Any] = response.json()
    return payload


def graphql_data(client: Client, query: str, **variables: Any) -> dict[str, Any]:
    """Fail loudly with the server message instead of a None dereference."""

    payload = graphql(client, query, **variables)
    assert "errors" not in payload, payload["errors"]
    data: dict[str, Any] = payload["data"]
    return data


PRODUCTS_QUERY = """
query Products($filter: ProductFilterInput, $first: Int, $after: String, $sort: String) {
  products(filter: $filter, first: $first, after: $after, sort: $sort) {
    totalCount
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      name
      salePrice
      purchasePrice
      catalogStatus
      extraAttributes
      stock { onHand reserved available activeFulfilment }
    }
  }
}
"""


def test_products_paginate_by_cursor_and_project_availability() -> None:
    client, context = signed_in("owner-contract@example.com")
    for index in range(3):
        create_product(
            context=context,
            name=f"Producto {index}",
            sale_price=str(1000 * (index + 1)),
            initial_quantity=index + 1,
        )

    first_page = graphql(client, PRODUCTS_QUERY, first=2)["data"]["products"]
    cursor = first_page["pageInfo"]["endCursor"]
    second_page = graphql(client, PRODUCTS_QUERY, first=2, after=cursor)["data"]["products"]

    assert first_page["totalCount"] == 3
    assert [node["name"] for node in first_page["nodes"]] == ["Producto 0", "Producto 1"]
    assert first_page["pageInfo"]["hasNextPage"] is True
    assert [node["name"] for node in second_page["nodes"]] == ["Producto 2"]
    assert second_page["pageInfo"]["hasNextPage"] is False
    assert first_page["nodes"][0]["stock"] == {
        "onHand": 1,
        "reserved": 0,
        "available": 1,
        "activeFulfilment": 0,
    }
    assert first_page["nodes"][0]["salePrice"] == "1000"


def test_filters_search_states_and_custom_columns() -> None:
    client, context = signed_in("owner-filters@example.com")
    definition = create_custom_field(
        context=context,
        label="Bodega",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
        is_filterable=True,
    )
    create_product(
        context=context,
        name="Cargador rápido",
        initial_quantity=4,
        extra_attributes={definition.key: "Central"},
    )
    create_product(
        context=context,
        name="Cable USB",
        extra_attributes={definition.key: "Norte"},
    )

    search = graphql(client, PRODUCTS_QUERY, filter={"search": "cable"})["data"]["products"]
    out_of_stock = graphql(
        client,
        PRODUCTS_QUERY,
        filter={"stockStates": ["out_of_stock"]},
    )["data"]["products"]
    by_column = graphql(
        client,
        PRODUCTS_QUERY,
        filter={"attributes": [{"key": definition.key, "value": "Central"}]},
    )["data"]["products"]
    unknown_column = graphql(
        client,
        PRODUCTS_QUERY,
        filter={"attributes": [{"key": "inexistente", "value": "x"}]},
    )

    assert [node["name"] for node in search["nodes"]] == ["Cable USB"]
    assert [node["name"] for node in out_of_stock["nodes"]] == ["Cable USB"]
    assert [node["name"] for node in by_column["nodes"]] == ["Cargador rápido"]
    assert unknown_column["errors"][0]["extensions"]["code"] == "UNKNOWN_CUSTOM_FIELD"


def test_create_product_and_movement_are_idempotent_over_graphql() -> None:
    client, context = signed_in("owner-mutation@example.com")
    mutation = """
    mutation CreateProduct($input: CreateProductInput!) {
      createProduct(input: $input) {
        replayed
        product { id name stock { onHand available } }
        movement { movementType quantity balanceAfter }
      }
    }
    """
    payload = {
        "name": "Audífonos",
        "salePrice": "19990",
        "initialQuantity": 6,
        "idempotencyKey": "graphql-create-1",
    }

    created = graphql(client, mutation, input=payload)["data"]["createProduct"]
    replayed = graphql(client, mutation, input=payload)["data"]["createProduct"]

    assert created["replayed"] is False
    assert replayed["replayed"] is True
    assert created["product"]["id"] == replayed["product"]["id"]
    assert created["movement"] == {
        "movementType": "entry",
        "quantity": 6,
        "balanceAfter": 6,
    }
    assert Product.objects.filter(inventory=context.inventory).count() == 1
    assert StockMovement.objects.filter(inventory=context.inventory).count() == 1

    adjust = """
    mutation Adjust($input: RecordStockMovementInput!) {
      recordStockMovement(input: $input) {
        replayed
        movement { quantity balanceAfter reason }
        product { stock { onHand available } }
      }
    }
    """
    adjust_input = {
        "productId": created["product"]["id"],
        "movementType": "shrinkage",
        "quantity": 2,
        "reason": "Rotura en bodega",
        "idempotencyKey": "graphql-adjust-1",
    }
    first = graphql(client, adjust, input=adjust_input)["data"]["recordStockMovement"]
    again = graphql(client, adjust, input=adjust_input)["data"]["recordStockMovement"]

    assert first["movement"] == {
        "quantity": -2,
        "balanceAfter": 4,
        "reason": "Rotura en bodega",
    }
    assert again["replayed"] is True
    assert again["product"]["stock"] == {"onHand": 4, "available": 4}


def test_detail_sections_are_declared_even_before_sales_exist() -> None:
    client, context = signed_in("owner-detail@example.com")
    product = create_product(context=context, name="Escritorio", initial_quantity=2).product

    detail = graphql(
        client,
        """
        query Detail($id: ID!) {
          product(id: $id) { id name stock { onHand available } }
          productStockBreakdown(productId: $id) {
            available
            lines { kind label quantity effectivePrice }
          }
          stockMovements(productId: $id) {
            totalCount
            nodes { movementType quantity balanceAfter actorName }
          }
          productOrders(productId: $id) { totalCount availableFromStage nodes { id } }
          productShipments(productId: $id) { totalCount availableFromStage nodes { id } }
        }
        """,
        id=str(product.public_id),
    )["data"]

    assert detail["product"]["stock"]["available"] == 2
    assert detail["productStockBreakdown"]["lines"][0]["kind"] == "available"
    assert detail["productStockBreakdown"]["lines"][0]["quantity"] == 2
    assert detail["stockMovements"]["totalCount"] == 1
    assert detail["productOrders"] == {
        "totalCount": 0,
        "availableFromStage": "sales",
        "nodes": [],
    }
    assert detail["productShipments"]["availableFromStage"] == "shipping"


def test_dashboard_and_schema_reflect_the_inventory() -> None:
    client, context = signed_in("owner-dashboard@example.com")
    create_custom_field(
        context=context,
        label="Color",
        field_type=CustomFieldDefinition.FieldType.SINGLE_SELECT,
        options=[{"label": "Rojo"}, {"label": "Azul"}],
    )
    create_product(context=context, name="Silla", initial_quantity=3)
    create_product(context=context, name="Mesa")

    data = graphql_data(
        client,
        """
        query {
          inventoryDashboard {
            productCount
            onHand
            available
            outOfStockCount
            recentMovements { movementType quantity productName }
          }
          inventorySchema {
            name
            maxActiveFields
            fields { key label fieldType options { key label } isFilterable }
          }
        }
        """,
    )

    assert data["inventoryDashboard"]["productCount"] == 2
    assert data["inventoryDashboard"]["onHand"] == 3
    assert data["inventoryDashboard"]["outOfStockCount"] == 1
    assert data["inventoryDashboard"]["recentMovements"][0]["productName"] == "Silla"
    assert data["inventorySchema"]["maxActiveFields"] == 15
    assert data["inventorySchema"]["fields"][0]["key"] == "color"
    assert [option["key"] for option in data["inventorySchema"]["fields"][0]["options"]] == [
        "rojo",
        "azul",
    ]


def test_another_tenant_cannot_read_a_product_by_id() -> None:
    _client, other_context = signed_in("owner-tenant-x@example.com")
    product = create_product(context=other_context, name="Privado", initial_quantity=1).product
    client, _context = signed_in("owner-tenant-y@example.com")

    response = graphql(
        client,
        "query Detail($id: ID!) { product(id: $id) { id name } }",
        id=str(product.public_id),
    )

    assert response["errors"][0]["extensions"]["code"] == "NOT_FOUND"
    assert response["data"]["product"] is None
