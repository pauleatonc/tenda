"""Gender-neutral membership labels for the public contract."""

from __future__ import annotations

from .models import Membership

ROLE_LABELS = {
    Membership.Role.OWNER: "titular",
    Membership.Role.OPERATOR: "equipo",
    Membership.Role.SUPPORT_ADMIN: "soporte",
}


def role_label(role: str) -> str:
    return ROLE_LABELS.get(role, role)
