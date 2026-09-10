"""Chilean region/commune catalog for delivery and tax addresses.

Source: https://juanbrujo.github.io/chile-regiones-comunas/data/original-simple.json
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_CATALOG_PATH = Path(__file__).resolve().parent / "data" / "chile_regiones_comunas.json"


@lru_cache(maxsize=1)
def chile_catalog() -> dict[str, Any]:
    return json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def chile_communes_by_region() -> dict[str, frozenset[str]]:
    return {
        str(item["region"]): frozenset(str(name) for name in item["comunas"])
        for item in chile_catalog()["regiones"]
    }


def is_valid_chile_location(region: str, commune: str) -> bool:
    communes = chile_communes_by_region().get(region.strip())
    return communes is not None and commune.strip() in communes
