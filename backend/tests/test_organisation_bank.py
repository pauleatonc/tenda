from __future__ import annotations

import pytest
from django.utils import timezone

from apps.organisations.bank import (
    cleaned_bank_details,
    format_rut,
    has_complete_bank_details,
    is_valid_rut,
)
from apps.organisations.selectors import resolve_tenant_context
from apps.organisations.services import create_organisation_for_owner, update_organisation
from apps.users.models import User
from tenda.errors import DomainError

pytestmark = pytest.mark.django_db(transaction=True)


def test_validates_and_formats_chilean_rut() -> None:
    assert is_valid_rut("11.111.111-1")
    assert is_valid_rut("11111111-1")
    assert format_rut("111111111") == "11.111.111-1"
    assert not is_valid_rut("11.111.111-2")
    assert not is_valid_rut("")


def test_cleaned_bank_details_reject_partial_or_invalid() -> None:
    with pytest.raises(DomainError) as error:
        cleaned_bank_details(
            {
                "bank_name": "BancoEstado",
                "bank_account_type": "cuenta_corriente",
            }
        )
    assert error.value.code == "VALIDATION_ERROR"
    assert "bankAccountNumber" in error.value.field_errors
    complete = cleaned_bank_details(
        {
            "bank_name": "BancoEstado",
            "bank_account_type": "cuenta_corriente",
            "bank_account_number": "12 345 678",
            "bank_holder_tax_id": "111111111",
            "bank_confirmation_email": "Pagos@Taller.cl",
        }
    )
    assert complete["bank_account_number"] == "12345678"
    assert complete["bank_holder_tax_id"] == "11.111.111-1"
    assert complete["bank_confirmation_email"] == "pagos@taller.cl"
    assert cleaned_bank_details({}) == {
        "bank_name": "",
        "bank_account_type": "",
        "bank_account_number": "",
        "bank_holder_tax_id": "",
        "bank_confirmation_email": "",
    }


def test_owner_can_save_bank_details_on_the_organisation() -> None:
    user = User.objects.create_user(
        email="bank-owner@example.com",
        password="Correct-Horse-Battery-42",
        email_verified_at=timezone.now(),
    )
    create_organisation_for_owner(owner=user, name="Taller Banco")
    context = resolve_tenant_context(user)
    assert has_complete_bank_details(context.organisation) is False
    updated = update_organisation(
        context=context,
        name="Taller Banco",
        phone="",
        business_email=user.email,
        timezone_name="America/Santiago",
        update_bank_details=True,
        bank_name="BancoEstado",
        bank_account_type="cuenta_vista",
        bank_account_number="987654321",
        bank_holder_tax_id="11.111.111-1",
        bank_confirmation_email="depositos@taller.cl",
    )
    assert has_complete_bank_details(updated) is True
    assert updated.bank_account_type == "cuenta_vista"
    assert updated.bank_holder_tax_id == "11.111.111-1"
