"""Identity reads with no credential material in their result contracts."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from tenda.errors import ResourceNotFound

from .models import MobileSession, Profile, User


def profile_for_user(user: User) -> Profile:
    profile = Profile.objects.filter(user=user).first()
    if profile is None:
        raise ResourceNotFound()
    return profile


def mobile_sessions_for_user(user: User) -> QuerySet[MobileSession]:
    return MobileSession.objects.filter(user=user).select_related(
        "active_organisation",
        "active_inventory",
    )


def mobile_session_for_user(user: User, public_id: uuid.UUID) -> MobileSession:
    session = mobile_sessions_for_user(user).filter(public_id=public_id).first()
    if session is None:
        raise ResourceNotFound()
    return session
