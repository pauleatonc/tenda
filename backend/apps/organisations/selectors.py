"""Tenant-safe organisation reads."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from django.db.models import QuerySet

from apps.inventory.models import Inventory
from apps.users.models import User
from tenda.errors import AuthenticationRequired, ResourceNotFound

from .models import Membership, Organisation


@dataclass(frozen=True, slots=True)
class TenantContext:
    user: User
    organisation: Organisation
    membership: Membership
    inventory: Inventory


def active_memberships(user: User) -> QuerySet[Membership]:
    if not user.is_authenticated or not user.is_active:
        return Membership.objects.none()
    return Membership.objects.filter(
        user=user,
        is_active=True,
        organisation__is_active=True,
    ).select_related("organisation", "user", "user__profile")


def organisation_for_user(user: User, public_id: uuid.UUID) -> Organisation:
    organisation = (
        Organisation.objects.filter(
            public_id=public_id,
            is_active=True,
            memberships__user=user,
            memberships__is_active=True,
        )
        .distinct()
        .first()
    )
    if organisation is None:
        raise ResourceNotFound()
    return organisation


def membership_for_user(user: User, organisation: Organisation) -> Membership:
    membership = (
        Membership.objects.filter(
            user=user,
            organisation=organisation,
            is_active=True,
            organisation__is_active=True,
        )
        .select_related("organisation", "user", "user__profile")
        .first()
    )
    if membership is None:
        raise ResourceNotFound()
    return membership


def inventory_for_context(
    organisation: Organisation,
    public_id: uuid.UUID | None = None,
) -> Inventory:
    inventories = Inventory.objects.filter(organisation=organisation, is_active=True)
    inventory = (
        inventories.filter(public_id=public_id).first()
        if public_id is not None
        else inventories.order_by("created_at").first()
    )
    if inventory is None:
        raise ResourceNotFound()
    return inventory


def resolve_tenant_context(
    user: User,
    *,
    organisation_id: uuid.UUID | None = None,
    inventory_id: uuid.UUID | None = None,
) -> TenantContext:
    if not user.is_authenticated or not user.is_active:
        raise AuthenticationRequired()
    membership = (
        active_memberships(user).filter(organisation__public_id=organisation_id).first()
        if organisation_id is not None
        else active_memberships(user).order_by("created_at").first()
    )
    if membership is None:
        raise ResourceNotFound()
    inventory = inventory_for_context(membership.organisation, inventory_id)
    return TenantContext(
        user=user,
        organisation=membership.organisation,
        membership=membership,
        inventory=inventory,
    )


def members_for_context(context: TenantContext) -> QuerySet[Membership]:
    return Membership.objects.filter(
        organisation=context.organisation,
        is_active=True,
    ).select_related("user", "user__profile", "organisation")


def member_for_context(context: TenantContext, public_id: uuid.UUID) -> Membership:
    membership = members_for_context(context).filter(public_id=public_id).first()
    if membership is None:
        raise ResourceNotFound()
    return membership
