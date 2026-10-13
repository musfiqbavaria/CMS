"""Phase 8 tests: checks, transitions, notifications, users, retention."""

from unittest.mock import patch

import pytest
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from apps.monitoring.models import Notification
from apps.sites.models import Site
from config.asgi import application

User = get_user_model()


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def admin_client(client, db):
    User.objects.create_user(
        username="owner", email="o@x.com", password="StrongPass123!", role="superadmin"
    )
    login = client.post(
        "/api/v1/auth/login/", {"username": "owner", "password": "StrongPass123!"}
    )
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {login.json()['access']}"
    return client


@pytest.fixture
def site(db):
    return Site.objects.create(
        name="Mon", domain="mon.example.com", status=Site.Statuses.ACTIVE
    )


class FakeResult:
    def __init__(self, text="", status_code=200, url="https://mon.example.com"):
        self.text = text
        self.status_code = status_code
        self.url = url


def test_uptime_ok_and_fail_transition(admin_client, site):
    from apps.monitoring.services import check_uptime

    with patch(
        "apps.monitoring.services.safe_fetch", return_value=FakeResult(status_code=200)
    ):
        check = check_uptime(site)
    assert check.status == "ok"
    assert Notification.objects.count() == 0

    with patch("apps.monitoring.services.safe_fetch", side_effect=Exception("boom")):
        check_uptime(site)
    note = Notification.objects.get(kind="site_down")
    assert "mon.example.com" in note.title

    # Repeated failure while already down: no duplicate notification.
    with patch("apps.monitoring.services.safe_fetch", side_effect=Exception("boom")):
        check_uptime(site)
    assert Notification.objects.filter(kind="site_down").count() == 1

    # Recovery notifies once.
    with patch(
        "apps.monitoring.services.safe_fetch", return_value=FakeResult(status_code=200)
    ):
        check_uptime(site)
    assert Notification.objects.filter(kind="site_recovered").count() == 1


def test_connector_presence(admin_client, site):
    from apps.monitoring.services import check_connector

    html = f'<script src="/connector/v1/loader.js?site={site.site_key}"></script>'
    with patch(
        "apps.monitoring.services.safe_fetch", return_value=FakeResult(text=html)
    ):
        assert check_connector(site).status == "ok"
    with patch(
        "apps.monitoring.services.safe_fetch",
        return_value=FakeResult(text="<html></html>"),
    ):
        assert check_connector(site).status == "fail"
    assert Notification.objects.filter(kind="connector_missing").count() == 1


def test_ssl_days_math():
    import time

    from apps.monitoring.services import days_until

    assert days_until(time.time() + 10 * 86400) in (9, 10)
    assert days_until(time.time() - 86400) <= -1


def test_summary_and_checks_api(admin_client, site):
    from apps.monitoring.services import check_uptime

    with patch(
        "apps.monitoring.services.safe_fetch", return_value=FakeResult(status_code=200)
    ):
        check_uptime(site)
    summary = admin_client.get("/api/v1/monitoring/summary/").json()
    row = next(r for r in summary if r["domain"] == "mon.example.com")
    assert row["overall"] == "ok"
    assert row["checks"]["uptime"]["status"] == "ok"
    checks = admin_client.get(f"/api/v1/monitoring/checks/?site={site.pk}")
    assert checks.json()["count"] == 1
    assert (
        admin_client.get("/api/v1/monitoring/checks/?status=fail").json()["count"] == 0
    )


def test_notifications_api_and_socket(admin_client, site):
    from apps.monitoring.services import notify

    notify(site, "info", "Hello")
    assert (
        admin_client.get("/api/v1/monitoring/notifications/?read=false").json()["count"]
        == 1
    )
    marked = admin_client.post("/api/v1/monitoring/notifications/mark-all-read/")
    assert marked.status_code == 200
    assert (
        admin_client.get("/api/v1/monitoring/notifications/?read=false").json()["count"]
        == 0
    )


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_notification_socket_push():
    from channels.db import database_sync_to_async

    user = await database_sync_to_async(User.objects.create_user)(
        username="sock2", email="s2@x.com", password="StrongPass123!"
    )
    token = await database_sync_to_async(
        lambda: str(RefreshToken.for_user(user).access_token)
    )()
    comm = WebsocketCommunicator(application, f"/ws/notifications/?token={token}")
    connected, _ = await comm.connect()
    assert connected is True
    assert (await comm.receive_json_from())["stage"] == "connected"

    def _notify():
        from apps.monitoring.services import notify as sync_notify

        return sync_notify(None, "info", "Live test")

    note = await database_sync_to_async(_notify)()
    event = await comm.receive_json_from()
    assert event["title"] == "Live test"
    assert event["id"] == note.pk
    await comm.disconnect()


def test_users_api_guards(admin_client, db):
    me = User.objects.get(username="owner")
    # List + create.
    assert admin_client.get("/api/v1/users/").json()["count"] >= 1
    created = admin_client.post(
        "/api/v1/users/",
        {
            "username": "ed",
            "email": "ed@x.com",
            "password": "StrongPass123!",
            "role": "admin",
        },
        content_type="application/json",
    )
    assert created.status_code == 201
    other_id = created.json()["id"]
    # Role change works on others.
    assert (
        admin_client.patch(
            f"/api/v1/users/{other_id}/",
            {"role": "superadmin"},
            content_type="application/json",
        ).status_code
        == 200
    )
    # Self-demote / self-deactivate / self-delete blocked; no-op self edit allowed.
    assert (
        admin_client.patch(
            f"/api/v1/users/{me.pk}/",
            {"role": "admin"},
            content_type="application/json",
        ).status_code
        == 400
    )
    assert (
        admin_client.patch(
            f"/api/v1/users/{me.pk}/",
            {"first_name": "Ow"},
            content_type="application/json",
        ).status_code
        == 200
    )
    admin_client.patch(
        f"/api/v1/users/{me.pk}/", {"is_active": False}, content_type="application/json"
    )
    assert admin_client.delete(f"/api/v1/users/{me.pk}/").status_code == 400
    me.refresh_from_db()
    assert me.is_active is True  # self-deactivate refused
    # Deleting the other user works.
    assert admin_client.delete(f"/api/v1/users/{other_id}/").status_code == 204


def test_beat_schedules_exist(db):
    from django_celery_beat.models import PeriodicTask

    names = set(PeriodicTask.objects.values_list("name", flat=True))
    assert {
        "uptime check (5 min)",
        "ssl expiry check (daily)",
        "connector presence check (daily)",
        "sitemap refresh (daily)",
        "database backup (daily)",
        "retention cleanup (daily)",
    } <= names


def test_cleanup_trims_versions(admin_client, site, settings):
    from apps.content.models import ConfigVersion
    from apps.content.services import get_or_create_config, save_draft

    settings.VERSION_KEEP_COUNT = 3
    get_or_create_config(site)
    for _ in range(5):
        save_draft(actor=None, site=site)
    assert ConfigVersion.objects.filter(site=site).count() == 5
    from apps.monitoring.tasks import cleanup_old

    result = cleanup_old.apply().get()
    assert result["versions_removed"] == 2
    assert ConfigVersion.objects.filter(site=site).count() == 3


def test_db_backup_writes_file(admin_client, settings, tmp_path):
    from apps.monitoring.tasks import db_backup

    settings.BACKUP_DIR = str(tmp_path)
    result = db_backup.apply().get()
    assert result["status"] == "backed_up"
    assert (tmp_path / result["file"]).stat().st_size > 1000
