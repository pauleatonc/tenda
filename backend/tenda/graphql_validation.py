"""Bound GraphQL work before resolvers execute."""

from __future__ import annotations

from django.conf import settings
from graphql import GraphQLError
from graphql.language.ast import FieldNode
from graphql.validation import ASTValidationRule, ValidationContext


class QueryBudgetRule(ASTValidationRule):
    """Reject documents that exceed configured depth or field count."""

    def __init__(self, context: ValidationContext) -> None:
        super().__init__(context)
        self.depth = 0
        self.field_count = 0
        self.max_depth = int(getattr(settings, "GRAPHQL_MAX_DEPTH", 12))
        self.max_fields = int(getattr(settings, "GRAPHQL_MAX_FIELDS", 250))
        self.reported_depth = False
        self.reported_fields = False

    def enter_field(self, node: FieldNode, *_args: object) -> None:
        self.depth += 1
        self.field_count += 1
        if self.depth > self.max_depth and not self.reported_depth:
            self.report_error(
                GraphQLError(
                    f"La consulta supera la profundidad máxima de {self.max_depth}.",
                    nodes=node,
                    extensions={"code": "QUERY_TOO_DEEP"},
                )
            )
            self.reported_depth = True
        if self.field_count > self.max_fields and not self.reported_fields:
            self.report_error(
                GraphQLError(
                    f"La consulta supera el máximo de {self.max_fields} campos.",
                    nodes=node,
                    extensions={"code": "QUERY_TOO_COMPLEX"},
                )
            )
            self.reported_fields = True

    def leave_field(self, _node: FieldNode, *_args: object) -> None:
        self.depth -= 1
