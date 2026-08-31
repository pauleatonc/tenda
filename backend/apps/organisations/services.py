"""Transactional organisation commands and permission enforcement."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from django.db import transaction

from apps.inventory.models import Inventory
from apps.users.models import User
from tenda.errors import DomainError, PermissionDenied

from .models import Membership, Organisation
from .permissions import OrganisationPermission, require_permission
from .selectors import TenantContext, member_for_context


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
    try:
        organisation.full_clean()
    except Exception as exc:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"organisation": ["Los datos del negocio no son válidos."]},
        ) from exc
    organisation.save(update_fields=("name", "phone", "business_email", "timezone", "updated_at"))
    return organisation


def _validated_role(actor: User, role: str) -> str:
    valid_roles = {choice for choice, _label in Membership.Role.choices}
    if role not in valid_roles:
        raise DomainError(
            "VALIDATION_ERROR",
            "Revisa los datos ingresados.",
            field_errors={"role": ["Selecciona un rol válido."]},
        )
    if role == Membership.Role.SUPPORT_ADMIN and not actor.is_superuser:
        raise PermissionDenied()
    return role


@transaction.atomic
def add_member(
    *,
    context: TenantContext,
    email: str,
    role: str = Membership.Role.OPERATOR,
) -> Membership:
    require_permission(context.membership, OrganisationPermission.MANAGE_MEMBERS)
    clean_role = _validated_role(context.user, role)
    canonical_email = User.objects.normalize_email(email).strip().lower()
    user = User.objects.filter(email=canonical_email, is_active=True).first()
    if user is None:
        raise DomainError(
            "MEMBER_ACCOUNT_NOT_FOUND",
            "La persona debe crear una cuenta antes de ser agregada.",
            status=404,
        )
    membership, created = Membership.objects.select_for_update().get_or_create(
        organisation=context.organisation,
        user=user,
        defaults={"role": clean_role},
    )
    if not created:
        membership.role = clean_role
        membership.is_active = True
        membership.save(update_fields=("role", "is_active", "updated_at"))
    return membership


def _require_another_owner(membership: Membership) -> None:
    if membership.role != Membership.Role.OWNER:
        return
    has_other_owner = (
        Membership.objects.select_for_update()
        .filter(
            organisation=membership.organisation,
            role=Membership.Role.OWNER,
            is_active=True,
        )
        .exclude(pk=membership.pk)
        .exists()
    )
    if not has_other_owner:
        raise DomainError(
            "LAST_OWNER_REQUIRED",
            "La Tienda debe conservar al menos una persona Owner.",
            status=409,
        )


@transaction.atomic
def update_member(
    *,
    context: TenantContext,
    member_id: uuid.UUID,
    role: str,
    view_financials: bool,
    manage_members: bool,
    manage_sensitive_configuration: bool,
) -> Membership:
    require_permission(context.membership, OrganisationPermission.MANAGE_MEMBERS)
    membership = member_for_context(context, member_id)
    membership = Membership.objects.select_for_update().get(pk=membership.pk)
    clean_role = _validated_role(context.user, role)
    if membership.role == Membership.Role.OWNER and clean_role != Membership.Role.OWNER:
        _require_another_owner(membership)
    membership.role = clean_role
    membership.view_financials = view_financials
    membership.manage_members = manage_members
    membership.manage_sensitive_configuration = manage_sensitive_configuration
    membership.save(
        update_fields=(
            "role",
            "view_financials",
            "manage_members",
            "manage_sensitive_configuration",
            "updated_at",
        )
    )
    return membership


@transaction.atomic
def remove_member(*, context: TenantContext, member_id: uuid.UUID) -> Membership:
    require_permission(context.membership, OrganisationPermission.MANAGE_MEMBERS)
    membership = member_for_context(context, member_id)
    membership = Membership.objects.select_for_update().get(pk=membership.pk)
    _require_another_owner(membership)
    membership.is_active = False
    membership.save(update_fields=("is_active", "updated_at"))
    return membership
