"""Thin GraphQL identity contract."""

from __future__ import annotations

from typing import Any

import graphene
from graphql import GraphQLResolveInfo

from tenda.errors import DomainError
from tenda.graphql import context_from_info, graphql_error, user_from_info

from .models import Profile, User
from .selectors import profile_for_user
from .services import update_profile


class ProfileType(graphene.ObjectType):  # type: ignore[misc]
    id = graphene.ID(required=True)
    full_name = graphene.String(required=True)
    phone = graphene.String(required=True)
    locale = graphene.String(required=True)

    @staticmethod
    def resolve_id(root: Profile, _info: GraphQLResolveInfo) -> str:
        return str(root.public_id)


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
