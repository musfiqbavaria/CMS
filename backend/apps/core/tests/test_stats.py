"""Phase 2 tests: dashboard overview is admin-gated and returns live aggregates."""

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()
OVERVIEW_URL = "/api/v1/stats/overview/"


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
def test_overview_requires_auth(client):
    resp = client.get(OVERVIEW_URL)
    assert resp.status_code == 401


@pytest.mark.django_db
def test_overview_returns_live_data(client):
    User.objects.create_user(
        username="dash", email="d@example.com", password="StrongPass123!"
    )
    login = client.post(
        "/api/v1/auth/login/", {"username": "dash", "password": "StrongPass123!"}
    )
    access = login.json()["access"]
    resp = client.get(OVERVIEW_URL, HTTP_AUTHORIZATION=f"Bearer {access}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["users"]["total"] >= 1
    assert set(data["users"]) == {"total", "active", "locked", "two_fa_enabled"}
    assert isinstance(data["signups_by_day"], list)
    assert any(p["count"] >= 1 for p in data["signups_by_day"])
    assert isinstance(data["beat_schedules"], int)
    assert isinstance(data["recent_users"], list)
    assert set(data["system"]) == {"db", "redis", "celery"}
