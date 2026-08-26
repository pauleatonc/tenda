from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.organisations.models import Membership
from apps.users.models import AuthRateLimitBucket, User

pytestmark = pytest.mark.django_db(transaction=True)


def test_prepare_e2e_journey_is_idempotent_and_verifies_owner() -> None:
    AuthRateLimitBucket.objects.create(
        action="login",
        key_digest="e" * 64,
        window_started_at=timezone.now(),
        attempts=99,
    )
    call_command(
        "prepare_e2e_journey",
        email="e2e.owner@tenda.test",
        password="Correct-Horse-Battery-42",
    )
    call_command(
        "prepare_e2e_journey",
        email="e2e.owner@tenda.test",
        password="Correct-Horse-Battery-42",
        stdout=StringIO(),
    )

    user = User.objects.get(email="e2e.owner@tenda.test")
    membership = Membership.objects.get(user=user)

    assert user.is_email_verified
    assert user.check_password("Correct-Horse-Battery-42")
    assert membership.role == Membership.Role.OWNER
    assert Membership.objects.filter(user=user).count() == 1
    assert AuthRateLimitBucket.objects.count() == 0
