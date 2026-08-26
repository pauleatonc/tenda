"""Export the canonical Django GraphQL schema for client generation."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from django.core.management.base import BaseCommand
from graphql import print_schema

from tenda.schema import schema


class Command(BaseCommand):
    help = "Export the canonical GraphQL schema to an SDL file."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument("--output", required=True)

    def handle(self, *_args: object, **options: object) -> None:
        output = Path(str(options["output"]))
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(f"{print_schema(schema.graphql_schema).rstrip()}\n")
        self.stdout.write(self.style.SUCCESS(f"Schema exported to {output}"))
