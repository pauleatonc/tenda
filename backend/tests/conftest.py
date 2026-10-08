"""Shared pytest fixtures for the backend suite."""

from __future__ import annotations

import pytest

from apps.billing.models import Plan

# Mirrors billing.0002_seed_plans. Transaction-scoped tests flush tables and
# drop RunPython seed data; recreate the catalog before each case.
_SEEDED_PLANS = (
    ("free", "Gratis", 0, 5, False, 0, ""),
    ("starter", "Starter", 4990, 15, True, 1, "seed-starter"),
    ("growth", "Growth", 9990, 25, True, 2, "seed-growth"),
    ("pro", "Pro", 14990, None, True, 3, "seed-pro"),
)


@pytest.fixture(autouse=True)
def _reseed_billing_plans(db: None) -> None:
    for code, name, price, limit, ai, position, mp_id in _SEEDED_PLANS:
        Plan.objects.update_or_create(
            code=code,
            defaults={
                "name": name,
                "price_clp": price,
                "product_limit": limit,
                "ai_assisted_enabled": ai,
                "position": position,
                "mp_preapproval_plan_id": mp_id,
                "is_active": True,
            },
        )
