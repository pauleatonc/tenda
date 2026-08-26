"""Central membership permission matrix."""

from __future__ import annotations

from enum import StrEnum

from tenda.errors import PermissionDenied

from .models import Membership


class OrganisationPermission(StrEnum):
    VIEW_FINANCIALS = "view_financials"
    MANAGE_MEMBERS = "manage_members"
    MANAGE_SENSITIVE_CONFIGURATION = "manage_sensitive_configuration"
    MANAGE_INVENTORY_SCHEMA = "manage_inventory_schema"


def has_permission(membership: Membership, permission: OrganisationPermission) -> bool:
    if not membership.is_active:
        return False
    if permission is OrganisationPermission.VIEW_FINANCIALS:
        return membership.can_view_financials
    if permission is OrganisationPermission.MANAGE_MEMBERS:
        return membership.can_manage_members
    if permission is OrganisationPermission.MANAGE_SENSITIVE_CONFIGURATION:
        return membership.can_manage_sensitive_configuration
    if permission is OrganisationPermission.MANAGE_INVENTORY_SCHEMA:
        return membership.can_manage_inventory_schema
    return False


def require_permission(
    membership: Membership,
    permission: OrganisationPermission,
) -> None:
    if not has_permission(membership, permission):
        raise PermissionDenied()
