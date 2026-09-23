"""Typed reads for database-backed operational configuration."""

from __future__ import annotations

from typing import cast

from apps.organisations.models import Organisation

from .models import FeatureFlag, OperationalParameter


def parameter_value[T](
    key: str,
    *,
    organisation: Organisation | None = None,
    default: T,
) -> T:
    queryset = OperationalParameter.objects.filter(key=key, is_active=True)
    parameter = None
    if organisation is not None:
        parameter = queryset.filter(organisation=organisation).first()
    if parameter is None:
        parameter = queryset.filter(organisation__isnull=True).first()
    return cast(T, parameter.value) if parameter is not None else default


def feature_enabled(
    key: str,
    *,
    organisation: Organisation | None = None,
    default: bool = False,
) -> bool:
    queryset = FeatureFlag.objects.filter(key=key)
    flag = None
    if organisation is not None:
        flag = queryset.filter(organisation=organisation).first()
    if flag is None:
        flag = queryset.filter(organisation__isnull=True).first()
    return bool(flag.enabled) if flag is not None else default
