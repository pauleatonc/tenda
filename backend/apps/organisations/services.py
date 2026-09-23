"""Transactional organisation commands and permission enforcement."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from django.db import transaction

from apps.inventory.models import Inventory
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import ready_asset
from apps.users.models import User
from tenda.errors import DomainError

from .bank import BANK_FIELDS, cleaned_bank_details
from .models import Membership, Organisation
from .permissions import OrganisationPermission, require_permission
from .selectors import TenantContext


@dataclass(frozen=True, slots=True)
class OrganisationProvision:
    organisation: Organisation
    inventory: Inventory
    membership: Membership


@transaction.atomic
def create_organisation_for_owner(
    *,
    owner: User,
    name: str,
    timezone_name: str = "America/Santiago",
) -> OrganisationProvision:
    clean_name = name.strip()
    if not clean_name:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"organisationName": ["Ingresa el nombre del negocio."]},
        )
    organisation = Organisation.objects.create(
        name=clean_name,
        timezone=timezone_name,
        business_email=owner.email,
    )
    inventory = Inventory.objects.create(organisation=organisation)
    membership = Membership.objects.create(
        organisation=organisation,
        user=owner,
        role=Membership.Role.OWNER,
        view_financials=True,
        manage_members=True,
        manage_sensitive_configuration=True,
    )
    return OrganisationProvision(
        organisation=organisation,
        inventory=inventory,
        membership=membership,
    )


@transaction.atomic
def update_organisation(
    *,
    context: TenantContext,
    name: str,
    phone: str,
    business_email: str,
    timezone_name: str,
    address: str = "",
    description: str = "",
    logo_asset_id: uuid.UUID | None = None,
    bank_name: str | None = None,
    bank_account_type: str | None = None,
    bank_account_number: str | None = None,
    bank_holder_tax_id: str | None = None,
    bank_confirmation_email: str | None = None,
    update_bank_details: bool = False,
) -> Organisation:
    require_permission(
        context.membership,
        OrganisationPermission.MANAGE_SENSITIVE_CONFIGURATION,
    )
    clean_name = name.strip()
    if not clean_name:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"name": ["Ingresa el nombre del negocio."]},
        )
    organisation = Organisation.objects.select_for_update().get(pk=context.organisation.pk)
    organisation.name = clean_name
    organisation.phone = phone.strip()
    organisation.business_email = business_email.strip().lower()
    organisation.timezone = timezone_name.strip() or "America/Santiago"
    organisation.address = address.strip()
    organisation.description = description.strip()
    if update_bank_details:
        bank = cleaned_bank_details(
            {
                "bank_name": bank_name,
                "bank_account_type": bank_account_type,
                "bank_account_number": bank_account_number,
                "bank_holder_tax_id": bank_holder_tax_id,
                "bank_confirmation_email": bank_confirmation_email,
            }
        )
        organisation.bank_name = bank["bank_name"]
        organisation.bank_account_type = bank["bank_account_type"]
        organisation.bank_account_number = bank["bank_account_number"]
        organisation.bank_holder_tax_id = bank["bank_holder_tax_id"]
        organisation.bank_confirmation_email = bank["bank_confirmation_email"]
    if logo_asset_id is not None:
        ready_asset(
            context=context,
            public_id=logo_asset_id,
            purpose=MediaAsset.Purpose.ORGANISATION_LOGO,
        )
        organisation.logo_asset_id = logo_asset_id
    try:
        organisation.full_clean()
    except Exception as exc:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"organisation": ["Los datos del negocio no son válidos."]},
        ) from exc
    update_fields = [
        "name",
        "phone",
        "business_email",
        "timezone",
        "address",
        "description",
        "logo_asset_id",
        "updated_at",
    ]
    if update_bank_details:
        update_fields.extend(BANK_FIELDS)
    organisation.save(update_fields=tuple(update_fields))
    return organisation
