"""Public GraphQL surface for site configuration content."""

from __future__ import annotations

from typing import Any

import graphene
from graphql import GraphQLResolveInfo

from .models import TermsAndConditions


class TermsAndConditionsType(graphene.ObjectType):  # type: ignore[misc]
    title = graphene.String(required=True)
    body_html = graphene.String(required=True)
    updated_at = graphene.DateTime(required=True)


class ConfigurationQuery(graphene.ObjectType):  # type: ignore[misc]
    terms_and_conditions = graphene.Field(TermsAndConditionsType)

    @staticmethod
    def resolve_terms_and_conditions(
        _root: object,
        _info: GraphQLResolveInfo,
    ) -> dict[str, Any] | None:
        terms = TermsAndConditions.get_solo()
        if terms is None:
            return None
        return {
            "title": terms.title,
            "body_html": terms.body_html,
            "updated_at": terms.updated_at,
        }
