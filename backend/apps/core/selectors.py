"""Read-only queries for core endpoints (dashboard overview). No writes here."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

OVERVIEW_CACHE_KEY = "dashboard:overview"
OVERVIEW_CACHE_TTL = 45


def check_database() -> str:
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
        return "ok"
    except Exception:
        return "error"


def check_redis() -> str:
    try:
        cache.set("healthcheck", "ok", timeout=10)
        return "ok" if cache.get("healthcheck") == "ok" else "error"
    except Exception:
        return "error"


def check_celery_worker() -> str:
    """Ping live workers via the broker; short timeout so the endpoint stays fast."""
    try:
        from config.celery import app as celery_app

        replies = celery_app.control.inspect(timeout=1).ping()
        return "ok" if replies else "error"
    except Exception:
        return "error"


def user_stats() -> dict:
    User = get_user_model()
    now = timezone.now()
    return {
        "total": User.objects.count(),
        "active": User.objects.filter(is_active=True).count(),
        "locked": User.objects.filter(locked_until__gt=now).count(),
        "two_fa_enabled": User.objects.filter(is_2fa_enabled=True).count(),
    }


def signups_by_day(days: int = 14) -> list:
    User = get_user_model()
    since = timezone.now() - timedelta(days=days)
    rows = (
        User.objects.filter(date_joined__gte=since)
        .annotate(day=TruncDate("date_joined"))
        .values("day")
        .annotate(count=Count("id"))
        .order_by("day")
    )
    return [{"date": r["day"].isoformat(), "count": r["count"]} for r in rows]


def beat_schedule_count() -> int:
    from django_celery_beat.models import PeriodicTask

    return PeriodicTask.objects.count()


def recent_users(limit: int = 5) -> list:
    User = get_user_model()
    return list(
        User.objects.order_by("-date_joined").values(
            "id", "username", "email", "role", "is_2fa_enabled", "date_joined"
        )[:limit]
    )


def dashboard_overview() -> dict:
    """Aggregated dashboard data, cached briefly (45 s) per architecture spec."""
    cached = cache.get(OVERVIEW_CACHE_KEY)
    if cached is not None:
        return cached
    payload = {
        "users": user_stats(),
        "signups_by_day": signups_by_day(),
        "beat_schedules": beat_schedule_count(),
        "recent_users": recent_users(),
        "system": {
            "db": check_database(),
            "redis": check_redis(),
            "celery": check_celery_worker(),
        },
    }
    cache.set(OVERVIEW_CACHE_KEY, payload, OVERVIEW_CACHE_TTL)
    return payload
