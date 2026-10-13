"""Phase 0 regression tests: health endpoint + celery ping (eager)."""

import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_health_ok(client):
    resp = client.get(reverse("health"))
    assert resp.status_code in (200, 503)
    data = resp.json()
    assert "status" in data
    assert "db" in data and "redis" in data


def test_celery_ping_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True
    from apps.core.tasks import ping

    assert ping.apply().get() == "pong"
