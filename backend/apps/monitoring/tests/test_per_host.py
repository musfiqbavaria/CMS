"""Phase 13 tests: per-host uptime/SSL checks, summary breakdown, host filter."""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings

from apps.monitoring.models import Notification
from apps.sites.models import Site, SiteDomain

User = get_user_model()
BASE = "sites13.example.com"


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def admin_client(client, db):
    User.objects.create_user(
        username="watcher", email="w@x.com", password="StrongPass123!"
    )
    login = client.post(
        "/api/v1/auth/login/", {"username": "watcher", "password": "StrongPass123!"}
    )
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {login.json()['access']}"
    return client


@pytest.fixture
def built_site(db):
    with override_settings(PLATFORM_BASE_DOMAIN=BASE):
        site = Site.objects.create(
            name="Shop",
            domain=f"shop.{BASE}",
            type=Site.Types.BUILT,
            status=Site.Statuses.ACTIVE,
        )
        SiteDomain.objects.create(
            site=site,
            hostname="acme-store.example.org",
            kind=SiteDomain.Kinds.CUSTOM,
            verification_status=SiteDomain.VerificationStatuses.VERIFIED,
        )
        return site


class FakeResult:
    def __init__(self, text="", status_code=200, url="https://x"):
        self.text = text
        self.status_code = status_code
        self.url = url


def test_monitored_hostnames(built_site):
    from apps.monitoring.services import monitored_hostnames

    assert monitored_hostnames(built_site) == [
        f"shop.{BASE}",
        "acme-store.example.org",
    ]


def test_uptime_per_host_transitions_independently(admin_client, built_site):
    from apps.monitoring.services import check_uptime

    ok = FakeResult(status_code=200)
    with patch("apps.monitoring.services.safe_fetch", return_value=ok):
        assert check_uptime(built_site, f"shop.{BASE}").status == "ok"
    with patch("apps.monitoring.services.safe_fetch", side_effect=Exception("boom")):
        check_uptime(built_site, "acme-store.example.org")
    note = Notification.objects.get(kind="site_down")
    assert "acme-store.example.org" in note.title
    # Canonical host unaffected: still ok, no recovery spam.
    assert built_site.health_checks.filter(
        check_type="uptime", host=f"shop.{BASE}", status="ok"
    ).exists()
    assert Notification.objects.filter(kind="site_recovered").count() == 0


def test_ssl_warns_per_alias_hostname(admin_client, built_site, monkeypatch):
    import socket
    import ssl as ssl_module
    import time

    from apps.monitoring import services

    class FakeSock:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    class FakeSecure:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def getpeercert(self):
            return {
                "notAfter": time.strftime(
                    "%b %d %H:%M:%S %Y GMT", time.gmtime(time.time() + 5 * 86400)
                )
            }

    class FakeContext:
        def wrap_socket(self, sock, server_hostname=None):
            assert server_hostname == "acme-store.example.org"
            return FakeSecure()

    class SafeURL:
        def __init__(self, url):
            self.url = url

    monkeypatch.setattr(socket, "create_connection", lambda *a, **k: FakeSock())
    monkeypatch.setattr(ssl_module, "create_default_context", lambda: FakeContext())
    monkeypatch.setattr(services, "validate_public_url", lambda url: SafeURL(url))
    check = services.check_ssl(built_site, "acme-store.example.org")
    assert check.status == "ok"
    assert check.host == "acme-store.example.org"
    note = Notification.objects.get(kind="ssl_expiring")
    assert "acme-store.example.org" in note.title


def test_summary_reports_per_host_breakdown(admin_client, built_site):
    from apps.monitoring.services import check_uptime, monitoring_summary

    with patch(
        "apps.monitoring.services.safe_fetch", return_value=FakeResult(status_code=200)
    ):
        check_uptime(built_site, f"shop.{BASE}")
    with patch("apps.monitoring.services.safe_fetch", side_effect=Exception("boom")):
        check_uptime(built_site, "acme-store.example.org")
    (row,) = [r for r in monitoring_summary() if r["site"] == built_site.pk]
    assert row["overall"] == "fail"
    assert row["hosts"]["acme-store.example.org"]["uptime"] == "fail"
    assert row["hosts"][f"shop.{BASE}"]["uptime"] == "ok"


def test_history_filterable_by_host(admin_client, built_site):
    from apps.monitoring.services import check_uptime

    with patch(
        "apps.monitoring.services.safe_fetch", return_value=FakeResult(status_code=200)
    ):
        check_uptime(built_site, f"shop.{BASE}")
        check_uptime(built_site, "acme-store.example.org")
    resp = admin_client.get(
        f"/api/v1/monitoring/checks/?site={built_site.pk}&host=acme-store.example.org"
    )
    assert resp.status_code == 200
    rows = resp.json()["results"]
    assert rows and {r["host"] for r in rows} == {"acme-store.example.org"}


def test_public_renderer_varies_on_host(admin_client, built_site):
    resp = admin_client.get("/", HTTP_HOST="acme-store.example.org")
    assert resp.status_code == 200
    assert "Host" in resp["Vary"]


def test_run_check_endpoint(admin_client, built_site):
    from apps.monitoring.models import HealthCheck

    payload = {"site": built_site.pk, "check_type": "connector"}
    with patch(
        "apps.monitoring.services.safe_fetch",
        return_value=FakeResult(text="<html>no loader</html>", status_code=200),
    ):
        resp = admin_client.post(
            "/api/v1/monitoring/checks/run/", payload, content_type="application/json"
        )
    assert resp.status_code == 200, resp.json()
    assert resp.json()["status"] == "fail"
    assert HealthCheck.objects.filter(site=built_site, check_type="connector").exists()

    resp = admin_client.post(
        "/api/v1/monitoring/checks/run/",
        {"site": built_site.pk, "check_type": "nope"},
        content_type="application/json",
    )
    assert resp.status_code == 400
    resp = admin_client.post(
        "/api/v1/monitoring/checks/run/",
        {"site": built_site.pk, "check_type": "uptime", "host": "evil.example"},
        content_type="application/json",
    )
    assert resp.status_code == 400
