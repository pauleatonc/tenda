"""Composed GraphQL schema; business rules remain in services/selectors."""

import graphene
from graphql import GraphQLResolveInfo

from apps.inventory.graphql import InventoryMutation, InventoryQuery
from apps.organisations.graphql import OrganisationsMutation, OrganisationsQuery
from apps.sales.graphql import SalesMutation, SalesQuery
from apps.shipping.graphql import ShippingMutation, ShippingQuery
from apps.users.graphql import UsersMutation, UsersQuery


class Query(
    UsersQuery,
    OrganisationsQuery,
    InventoryQuery,
    ShippingQuery,
    SalesQuery,
    graphene.ObjectType,  # type: ignore[misc]
):
    health = graphene.String(required=True)

    @staticmethod
    def resolve_health(_root: object, _info: GraphQLResolveInfo) -> str:
        return "ok"


class Mutation(
    UsersMutation,
    OrganisationsMutation,
    InventoryMutation,
    ShippingMutation,
    SalesMutation,
    graphene.ObjectType,  # type: ignore[misc]
):
    pass


schema = graphene.Schema(query=Query, mutation=Mutation)
