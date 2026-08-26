from __future__ import annotations

from decimal import Decimal

import pytest
from django.utils import timezone

from apps.inventory.custom_fields import validate_extra_attributes
from apps.inventory.models import CustomFieldDefinition, Product
from apps.inventory.selectors import active_custom_fields, custom_field_for_context
from apps.inventory.services import (
    clean_reference_price,
    create_custom_field,
    reorder_custom_fields,
    update_custom_field,
)
from apps.organisations.models import Membership
from apps.organisations.selectors import TenantContext, resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner
from apps.users.models import User
from tenda.errors import DomainError, PermissionDenied, ResourceNotFound

pytestmark = pytest.mark.django_db(transaction=True)


def identity(
    email: str,
    *,
    role: str = Membership.Role.OWNER,
) -> tuple[User, TenantContext]:
    user = User.objects.create_user(
        email=email,
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    provision = create_organisation_for_owner(owner=user, name=f"Negocio {email}")
    if role != Membership.Role.OWNER:
        provision.membership.role = role
        provision.membership.view_financials = False
        provision.membership.manage_members = False
        provision.membership.manage_sensitive_configuration = False
        provision.membership.save()
    return user, resolve_tenant_context(user)


def make_product(context: TenantContext, name: str, **attributes: object) -> Product:
    return Product.objects.create(
        inventory=context.inventory,
        name=name,
        extra_attributes=dict(attributes),
    )


def test_active_column_limit_applies_to_creation_and_reactivation() -> None:
    _user, context = identity("owner-limit@example.com")
    definitions = [
        create_custom_field(
            context=context,
            label=f"Columna {index}",
            field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
        )
        for index in range(CustomFieldDefinition.MAX_ACTIVE_PER_INVENTORY)
    ]

    with pytest.raises(DomainError) as overflow:
        create_custom_field(
            context=context,
            label="Columna 16",
            field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
        )
    assert overflow.value.code == "CUSTOM_FIELD_LIMIT_REACHED"
    assert overflow.value.status == 409

    # Deactivating frees exactly one slot.
    update_custom_field(context=context, field_id=definitions[0].public_id, is_active=False)
    replacement = create_custom_field(
        context=context,
        label="Columna 16",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
    )
    assert replacement.is_active

    with pytest.raises(DomainError) as reactivation:
        update_custom_field(
            context=context,
            field_id=definitions[0].public_id,
            is_active=True,
        )
    assert reactivation.value.code == "CUSTOM_FIELD_LIMIT_REACHED"
    assert len(active_custom_fields(context)) == CustomFieldDefinition.MAX_ACTIVE_PER_INVENTORY


def test_renaming_a_label_keeps_the_key_and_the_stored_values() -> None:
    _user, context = identity("owner-rename@example.com")
    definition = create_custom_field(
        context=context,
        label="Talla",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
    )
    product = make_product(context, "Polera", **{definition.key: "M"})

    renamed = update_custom_field(
        context=context,
        field_id=definition.public_id,
        label="Talla de la prenda",
    )
    product.refresh_from_db()

    assert renamed.key == definition.key == "talla"
    assert renamed.label == "Talla de la prenda"
    assert product.extra_attributes == {"talla": "M"}


def test_deactivating_a_column_preserves_history_and_rejects_new_values() -> None:
    _user, context = identity("owner-history@example.com")
    definition = create_custom_field(
        context=context,
        label="Proveedor",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
    )
    product = make_product(context, "Taza", **{definition.key: "Andes"})

    update_custom_field(context=context, field_id=definition.public_id, is_active=False)
    product.refresh_from_db()
    assert product.extra_attributes == {"proveedor": "Andes"}

    with pytest.raises(DomainError) as unknown:
        validate_extra_attributes(
            custom_field_for_context(context, definition.public_id).inventory.custom_fields.all(),
            {"proveedor": "Otro"},
        )
    assert unknown.value.code == "UNKNOWN_CUSTOM_FIELD"

    kept = validate_extra_attributes(
        active_custom_fields(context),
        {},
        preserved=product.extra_attributes,
    )
    assert kept == {"proveedor": "Andes"}


def test_reference_prices_keep_null_and_zero_apart_and_reject_fractions() -> None:
    assert clean_reference_price(None, field="salePrice") is None
    assert clean_reference_price("", field="salePrice") is None
    assert clean_reference_price(0, field="salePrice") == Decimal("0")
    assert clean_reference_price("15990", field="salePrice") == Decimal("15990")

    with pytest.raises(DomainError) as fraction:
        clean_reference_price("1990.5", field="salePrice")
    assert fraction.value.field_errors["salePrice"] == ["Los montos en pesos no aceptan decimales."]

    with pytest.raises(DomainError):
        clean_reference_price(-1, field="purchasePrice")


def test_making_a_column_required_demands_a_backfill_value() -> None:
    _user, context = identity("owner-required@example.com")
    definition = create_custom_field(
        context=context,
        label="Origen",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
    )
    filled = make_product(context, "Cuaderno", **{definition.key: "Chile"})
    empty = make_product(context, "Lápiz")

    with pytest.raises(DomainError) as backfill:
        update_custom_field(
            context=context,
            field_id=definition.public_id,
            is_required=True,
        )
    assert backfill.value.code == "CUSTOM_FIELD_BACKFILL_REQUIRED"

    update_custom_field(
        context=context,
        field_id=definition.public_id,
        is_required=True,
        default_value="Sin especificar",
    )
    filled.refresh_from_db()
    empty.refresh_from_db()
    assert filled.extra_attributes == {"origen": "Chile"}
    assert empty.extra_attributes == {"origen": "Sin especificar"}


def test_values_are_typed_and_undeclared_keys_are_rejected() -> None:
    _user, context = identity("owner-values@example.com")
    create_custom_field(
        context=context,
        label="Vence",
        field_type=CustomFieldDefinition.FieldType.DATE,
    )
    create_custom_field(
        context=context,
        label="Peso",
        field_type=CustomFieldDefinition.FieldType.DECIMAL,
    )
    create_custom_field(
        context=context,
        label="Frágil",
        field_type=CustomFieldDefinition.FieldType.BOOLEAN,
    )
    create_custom_field(
        context=context,
        label="Color",
        field_type=CustomFieldDefinition.FieldType.SINGLE_SELECT,
        options=[{"label": "Rojo"}, {"label": "Azul"}],
    )
    definitions = active_custom_fields(context)

    stored = validate_extra_attributes(
        definitions,
        {
            "vence": "2026-12-01",
            "peso": "1.250",
            "fragil": True,
            "color": "azul",
        },
    )
    assert stored == {
        "vence": "2026-12-01",
        "peso": "1.25",
        "fragil": True,
        "color": "azul",
    }

    with pytest.raises(DomainError):
        validate_extra_attributes(definitions, {"vence": "01-12-2026"})
    with pytest.raises(DomainError):
        validate_extra_attributes(definitions, {"color": "verde"})
    with pytest.raises(DomainError) as unknown:
        validate_extra_attributes(definitions, {"sku_externo": "A-1"})
    assert unknown.value.code == "UNKNOWN_CUSTOM_FIELD"


def test_required_value_is_enforced_on_the_server() -> None:
    _user, context = identity("owner-server@example.com")
    create_custom_field(
        context=context,
        label="Bodega",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
        is_required=True,
    )
    with pytest.raises(DomainError) as missing:
        validate_extra_attributes(active_custom_fields(context), {"bodega": "   "})
    assert missing.value.code == "CUSTOM_FIELD_REQUIRED"
    assert "extraAttributes.bodega" in missing.value.field_errors


def test_schema_management_is_owner_only_and_tenant_safe() -> None:
    _owner, owner_context = identity("owner-schema@example.com")
    definition = create_custom_field(
        context=owner_context,
        label="Lote",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
    )

    _operator, operator_context = identity(
        "operator-schema@example.com",
        role=Membership.Role.OPERATOR,
    )
    with pytest.raises(PermissionDenied):
        create_custom_field(
            context=operator_context,
            label="Lote",
            field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
        )
    with pytest.raises(ResourceNotFound):
        custom_field_for_context(operator_context, definition.public_id)


def test_reorder_requires_the_full_set_and_persists_positions() -> None:
    _user, context = identity("owner-order@example.com")
    first = create_custom_field(
        context=context,
        label="Uno",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
    )
    second = create_custom_field(
        context=context,
        label="Dos",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
    )

    with pytest.raises(DomainError):
        reorder_custom_fields(context=context, field_ids=[second.public_id])

    ordered = reorder_custom_fields(
        context=context,
        field_ids=[second.public_id, first.public_id],
    )
    assert [item.key for item in ordered] == ["dos", "uno"]
    assert [item.key for item in active_custom_fields(context)] == ["dos", "uno"]


def test_duplicate_labels_and_reserved_keys_are_rejected() -> None:
    _user, context = identity("owner-dup@example.com")
    create_custom_field(
        context=context,
        label="Material",
        field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
    )
    with pytest.raises(DomainError) as duplicate:
        create_custom_field(
            context=context,
            label="  material ",
            field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
        )
    assert "label" in duplicate.value.field_errors or "key" in duplicate.value.field_errors

    with pytest.raises(DomainError) as reserved:
        create_custom_field(
            context=context,
            label="Precio venta",
            field_type=CustomFieldDefinition.FieldType.SHORT_TEXT,
            key="sale_price",
        )
    assert "key" in reserved.value.field_errors
