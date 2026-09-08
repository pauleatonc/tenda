"""Thin GraphQL identity contract."""

from __future__ import annotations

import uuid
from typing import Any

import graphene
from graphql import GraphQLResolveInfo

from apps.media_assets.models import MediaAsset
from apps.media_assets.services import asset_content_url
from tenda.errors import DomainError, ResourceNotFound
from tenda.graphql import context_from_info, graphql_error, user_from_info

from .models import Profile, User
from .selectors import profile_for_user
from .services import update_profile


class ProfileType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    full_name = graphene.String(required=True)
    phone = graphene.String(required=True)
    locale = graphene.String(required=True)
    photo_url = graphene.String()

    @staticmethod
    def resolve_id(root: Profile, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_photo_url(root: Profile, _info: GraphQLResolveInfo) -> str | None:
        if root.photo_asset_id is None:
            return None
        asset = MediaAsset.objects.filter(
            public_id=root.photo_asset_id,
            status=MediaAsset.Status.READY,
        ).first()
        return asset_content_url(asset, variant="thumbnail")


class ViewerType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    email = graphene.String(required=True)
    email_verified = graphene.Boolean(required=True)
    profile = graphene.Field(ProfileType, required=True)

    @staticmethod
    def resolve_id(root: User, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)

    @staticmethod
    def resolve_email_verified(root: User, _info: GraphQLResolveInfo) -> bool:
        return root.is_email_verified

    @staticmethod
    def resolve_profile(root: User, _info: GraphQLResolveInfo) -> Profile:
        return profile_for_user(root)


class UpdateProfileInput(graphene.InputObjectType):  # type: ignore[misc]
    full_name = graphene.String(required=True)
    phone = graphene.String(required=True)
    photo_asset_id = graphene.ID()


def _optional_uuid(value: object) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except ValueError as exc:
        raise ResourceNotFound() from exc


class UpdateProfile(graphene.Mutation):  # type: ignore[misc]
    class Arguments:
        input = graphene.Argument(UpdateProfileInput, required=True)

    profile = graphene.Field(ProfileType, required=True)

    @staticmethod
    def mutate(
        _root: object,
        info: GraphQLResolveInfo,
        input: dict[str, Any],
    ) -> UpdateProfile:
        try:
            profile = update_profile(
                user=user_from_info(info),
                full_name=str(input.get("full_name", "")),
                phone=str(input.get("phone", "")),
                photo_asset_id=_optional_uuid(input.get("photo_asset_id")),
            )
        except DomainError as exc:
            raise graphql_error(info, exc) from exc
        return UpdateProfile(profile=profile)


class UsersQuery(graphene.ObjectType):  # type: ignore[misc]
    viewer = graphene.Field(ViewerType)

    @staticmethod
    def resolve_viewer(_root: object, info: GraphQLResolveInfo) -> User:
        try:
            return context_from_info(info).user
        except DomainError as exc:
            raise graphql_error(info, exc) from exc


class UsersMutation(graphene.ObjectType):  # type: ignore[misc]
    update_profile = UpdateProfile.Field(required=True)
