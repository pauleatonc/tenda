"""Thin GraphQL organisation and membership contract."""

from __future__ import annotations

import uuid
from typing import Any

import graphene
from graphql import GraphQLResolveInfo

from apps.inventory.models import Inventory
from apps.media_assets.models import MediaAsset
from apps.media_assets.services import asset_content_url
from apps.organisations.labels import role_label
from tenda.errors import DomainError, ResourceNotFound
from tenda.graphql import context_from_info, graphql_error

from .models import Membership, Organisation
from .permissions import OrganisationPermission, require_permission
from .selectors import members_for_context
from .services import (
    add_member,
    remove_member,
    update_member,
    update_organisation,
)


class OrganisationType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    name = graphene.String(required=True)
    timezone = graphene.String(required=True)
    phone = graphene.String(required=True)
    business_email = graphene.String(required=True)
    address = graphene.String(required=True)
    description = graphene.String(required=True)
    logo_url = graphene.String()

    @staticmethod
    def resolve_id(root: Organisation, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_logo_url(root: Organisation, _info: GraphQLResolveInfo) -> str | None:
        if root.logo_asset_id is None:
            return None
        asset = MediaAsset.objects.filter(
            public_id=root.logo_asset_id,
            organisation_id=root.pk,
            status=MediaAsset.Status.READY,
        ).first()
        return asset_content_url(asset, variant="thumbnail")


class InventoryContextType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    name = graphene.String(required=True)

    @staticmethod
    def resolve_id(root: Inventory, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)


class MembershipPermissionsType(graphene.ObjectType):  # type: ignore[misc]
    view_financials = graphene.Boolean(required=True)
    manage_members = graphene.Boolean(required=True)
    manage_sensitive_configuration = graphene.Boolean(required=True)
    manage_inventory_schema = graphene.Boolean(required=True)

    @staticmethod
    def resolve_view_financials(
        root: Membership,
        _info: GraphQLResolveInfo,
    ) -> bool:
        return root.can_view_financials

    @staticmethod
    def resolve_manage_members(root: Membership, _info: GraphQLResolveInfo) -> bool:
        return root.can_manage_members

    @staticmethod
    def resolve_manage_sensitive_configuration(
        root: Membership,
        _info: GraphQLResolveInfo,
    ) -> bool:
        return root.can_manage_sensitive_configuration

    @staticmethod
    def resolve_manage_inventory_schema(
        root: Membership,
        _info: GraphQLResolveInfo,
    ) -> bool:
        return root.can_manage_inventory_schema


class MemberType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    email = graphene.String(required=True)
    full_name = graphene.String(required=True)
    role = graphene.String(required=True)
    role_label = graphene.String(required=True)
    permissions = graphene.Field(MembershipPermissionsType, required=True)

    @staticmethod
    def resolve_id(root: Membership, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_email(root: Membership, _info: GraphQLResolveInfo) -> str:
        return root.user.email

    @staticmethod
    def resolve_full_name(root: Membership, _info: GraphQLResolveInfo) -> str:
        return root.user.profile.full_name

    @staticmethod
    def resolve_role_label(root: Membership, _info: GraphQLResolveInfo) -> str:
        return role_label(root.role)

    @staticmethod
    def resolve_permissions(
        root: Membership,
        _info: GraphQLResolveInfo,
    ) -> Membership:
        return root


class UpdateOrganisationInput(graphene.InputObjectType):  # type: ignore[misc]
    name = graphene.String(required=True)
    phone = graphene.String(required=True)
    business_email = graphene.String(required=True)
    timezone = graphene.String(required=True)
    address = graphene.String()
    description = graphene.String()
    logo_asset_id = graphene.ID()


class UpdateOrganisation(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        input = graphene.Argument(UpdateOrganisationInput, required=True)

    organisation = graphene.Field(OrganisationType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        input: dict[str, Any],
    ) -> UpdateOrganisation:
        try:
            logo_raw = input.get("logo_asset_id")
            organisation = update_organisation(
                context=context_from_info(info),
                name=str(input.get("name", "")),
                phone=str(input.get("phone", "")),
                business_email=str(input.get("business_email", "")),
                timezone_name=str(input.get("timezone", "")),
                address=str(input.get("address") or ""),
                description=str(input.get("description") or ""),
                logo_asset_id=_uuid_or_not_found(logo_raw) if logo_raw else None,
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return UpdateOrganisation(organisation=organisation)


class AddMemberInput(graphene.InputObjectType):  # type: ignore[misc]
    email = graphene.String(required=True)
    role = graphene.String(default_value=Membership.Role.OPERATOR)


class AddOrganisationMember(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        input = graphene.Argument(AddMemberInput, required=True)

    member = graphene.Field(MemberType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        input: dict[str, Any],
    ) -> AddOrganisationMember:
        try:
            member = add_member(
                context=context_from_info(info),
                email=str(input.get("email", "")),
                role=str(input.get("role", Membership.Role.OPERATOR)),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return AddOrganisationMember(member=member)


class UpdateMemberInput(graphene.InputObjectType):  # type: ignore[misc]
    member_id = graphene.ID(required=True)
    role = graphene.String(required=True)
    view_financials = graphene.Boolean(required=True)
    manage_members = graphene.Boolean(required=True)
    manage_sensitive_configuration = graphene.Boolean(required=True)


def _uuid_or_not_found(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except ValueError as exc:
        raise ResourceNotFound() from exc


class UpdateOrganisationMember(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        input = graphene.Argument(UpdateMemberInput, required=True)

    member = graphene.Field(MemberType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        input: dict[str, Any],
    ) -> UpdateOrganisationMember:
        try:
            member = update_member(
                context=context_from_info(info),
                member_id=_uuid_or_not_found(input.get("member_id")),
                role=str(input.get("role", "")),
                view_financials=bool(input.get("view_financials")),
                manage_members=bool(input.get("manage_members")),
                manage_sensitive_configuration=bool(input.get("manage_sensitive_configuration")),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return UpdateOrganisationMember(member=member)


class RemoveOrganisationMember(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        member_id = graphene.ID(required=True)

    removed_member_id = graphene.ID(required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        member_id: object,
    ) -> RemoveOrganisationMember:
        try:
            member = remove_member(
                context=context_from_info(info),
                member_id=_uuid_or_not_found(member_id),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return RemoveOrganisationMember(removed_member_id=str(member.public_id))


class OrganisationsQuery(graphene.ObjectType):  # type: ignore[misc]
    organisation = graphene.Field(OrganisationType)
    active_inventory = graphene.Field(InventoryContextType)
    active_membership = graphene.Field(MemberType)
    members = graphene.List(graphene.NonNull(MemberType), required=True)

    @staticmethod
    def resolve_organisation(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> Organisation:
        try:
            return context_from_info(info).organisation
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_active_inventory(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> Inventory:
        try:
            return context_from_info(info).inventory
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_active_membership(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> Membership:
        try:
            return context_from_info(info).membership
        except DomainError as exc:
            raise graphql_error(info, exc) from exc

    @staticmethod
    def resolve_members(
        _root: object,
        info: GraphQLResolveInfo,
    ) -> list[Membership]:
        try:
            context = context_from_info(info)
            require_permission(
                context.membership,
                OrganisationPermission.MANAGE_MEMBERS,
            )
            return list(members_for_context(context))
        except DomainError as exc:
            raise graphql_error(info, exc) from exc


class OrganisationsMutation(graphene.ObjectType):  # type: ignore[misc]
    update_organisation = UpdateOrganisation.Field(required=True)
    add_organisation_member = AddOrganisationMember.Field(required=True)
    update_organisation_member = UpdateOrganisationMember.Field(required=True)
    remove_organisation_member = RemoveOrganisationMember.Field(required=True)
