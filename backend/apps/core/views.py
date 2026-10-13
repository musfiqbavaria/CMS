"""Health endpoint: verifies DB + Redis reachability, always public."""

import logging

from django.core.cache import cache
from django.db import connection
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    checks = {"db": "ok", "redis": "ok"}
    status_code = 200
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
    except Exception as exc:  # noqa: BLE001 - report backend fault as 503
        logger.warning("health db check failed: %s", exc)
        checks["db"] = "error"
        status_code = 503
    try:
        cache.set("healthcheck", "ok", timeout=10)
        if cache.get("healthcheck") != "ok":
            raise RuntimeError("redis roundtrip mismatch")
    except Exception as exc:  # noqa: BLE001
        logger.warning("health redis check failed: %s", exc)
        checks["redis"] = "error"
        status_code = 503
    return Response(
        {"status": "ok" if status_code == 200 else "degraded", **checks},
        status=status_code,
    )


@api_view(["GET"])
def dashboard_overview_view(request):
    """Admin dashboard aggregates. Default-deny permissions apply (no AllowAny)."""
    from .selectors import dashboard_overview

    return Response(dashboard_overview())
