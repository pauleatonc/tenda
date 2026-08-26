"""Dependency-aware health endpoints used by containers and monitoring."""

from django.conf import settings
from django.db import connections
from django.http import HttpRequest, JsonResponse
from redis import Redis


def live(_request: HttpRequest) -> JsonResponse:
    """Report that the ASGI process can serve requests."""
    return JsonResponse({"status": "ok"})


def ready(_request: HttpRequest) -> JsonResponse:
    """Report whether durable data and the configured broker are reachable."""
    checks: dict[str, bool] = {}

    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        checks["database"] = True
    except Exception:
        checks["database"] = False

    redis_url = str(getattr(settings, "REDIS_URL", ""))
    if redis_url:
        try:
            client = Redis.from_url(redis_url, socket_connect_timeout=1, socket_timeout=1)
            checks["redis"] = bool(client.ping())
            client.close()
        except Exception:
            checks["redis"] = False

    is_ready = all(checks.values())
    return JsonResponse(
        {
            "status": "ready" if is_ready else "not_ready",
            "checks": checks,
        },
        status=200 if is_ready else 503,
    )
