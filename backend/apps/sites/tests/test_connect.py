"""Phase 4 tests: discovery snapshots, meta/DNS verification, progress socket gate."""

from unittest.mock import patch

import pytest
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.sites.connect import check_dns_txt, check_meta_tag, parse_homepage
from apps.sites.models import Site
from config.asgi import application

User = get_user_model()
SITES_URL = "/api/v1/sites/"


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def admin_client(client, db):
    User.objects.create_user(
        username="owner", email="o@x.com", password="StrongPass123!"
    )
    login = client.post(
        "/api/v1/auth/login/", {"username": "owner", "password": "StrongPass123!"}
    )
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {login.json()['access']}"
    return client


@pytest.fixture
def site(db):
    return Site.objects.create(name="Example", domain="example.com")


def test_create_connected_site_queues_discovery(admin_client):
    with patch("apps.sites.tasks.discover_site.delay") as delayed:
        with TestCase.captureOnCommitCallbacks(execute=True):
            resp = admin_client.post(
                SITES_URL,
                {"name": "New", "domain": "new.example.com", "type": "connected"},
                content_type="application/json",
            )
        assert resp.status_code == 201
        delayed.assert_called_once()


def test_built_site_does_not_queue_discovery(admin_client):
    with patch("apps.sites.tasks.discover_site.delay") as delayed:
        with TestCase.captureOnCommitCallbacks(execute=True):
            resp = admin_client.post(
                SITES_URL,
                {"name": "Built", "domain": "built.example.com", "type": "built"},
                content_type="application/json",
            )
        assert resp.status_code == 201
        delayed.assert_not_called()


def test_parse_homepage_extracts_snapshot():
    html = """
    <html><head><title>My Shop</title>
    <meta name="description" content="Great shop">
    <meta name="theme-color" content="#112233">
    <link rel="icon" href="/favicon.ico">
    <meta property="og:image" content="https://cdn.example.com/og.png">
    </head><body></body></html>
    """
    snap = parse_homepage("https://example.com/", 200, html)
    assert snap["title"] == "My Shop"
    assert snap["description"] == "Great shop"
    assert snap["theme_color"] == "#112233"
    assert snap["favicon_url"] == "https://example.com/favicon.ico"
    assert snap["logo_url"] == "https://cdn.example.com/og.png"


def test_meta_verification_success_and_failure():
    good = '<html><head><meta name="cms-verify" content="TOK"></head></html>'
    with patch("apps.sites.connect.safe_fetch") as fetch:
        fetch.return_value = type("R", (), {"text": good, "status_code": 200})()
        assert check_meta_tag("example.com", "TOK") == (True, "Meta tag matches.")
    with patch("apps.sites.connect.safe_fetch") as fetch:
        fetch.return_value = type(
            "R", (), {"text": "<html></html>", "status_code": 200}
        )()
        ok, detail = check_meta_tag("example.com", "TOK")
        assert ok is False and "No <meta" in detail


def test_dns_verification_success_and_failure():
    class Txt:
        strings = [b"cms-verify=TOK"]

    with patch("apps.sites.connect.dns.resolver.resolve", return_value=[Txt()]):
        assert check_dns_txt("example.com", "TOK")[0] is True

    class Other:
        strings = [b"v=spf1 -all"]

    with patch("apps.sites.connect.dns.resolver.resolve", return_value=[Other()]):
        ok, detail = check_dns_txt("example.com", "TOK")
        assert ok is False and "No TXT" in detail


def test_discover_task_stores_snapshot(site):
    from apps.sites.tasks import discover_site

    snapshot = {"title": "T", "final_url": "https://example.com/", "status_code": 200}
    with patch("apps.sites.connect.discover_domain", return_value=snapshot):
        result = discover_site.apply(args=[site.pk]).get()
    assert result["status"] == "succeeded"
    site.refresh_from_db()
    assert site.discovery_status == "succeeded"
    assert site.discovery["title"] == "T"
    assert site.discovered_at is not None


def test_verify_task_marks_verified(site):
    from apps.sites.tasks import verify_site_ownership

    with patch(
        "apps.sites.connect.check_meta_tag", return_value=(True, "Meta tag matches.")
    ):
        result = verify_site_ownership.apply(args=[site.pk, "meta"]).get()
    assert result["status"] == "verified"
    site.refresh_from_db()
    assert site.verification_status == "verified"
    assert site.verified_at is not None


def test_verify_and_discover_endpoints(admin_client, site):
    with patch("apps.sites.tasks.verify_site_ownership.delay") as delayed:
        resp = admin_client.post(f"{SITES_URL}{site.pk}/verify/", {"method": "dns"})
        assert resp.status_code == 202
        delayed.assert_called_once_with(site.pk, "dns")
    bad = admin_client.post(f"{SITES_URL}{site.pk}/verify/", {"method": "email"})
    assert bad.status_code == 400
    with patch("apps.sites.tasks.discover_site.delay") as delayed:
        assert admin_client.post(f"{SITES_URL}{site.pk}/discover/").status_code == 202
        delayed.assert_called_once_with(site.pk)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
async def test_progress_socket_requires_admin_token():
    from channels.db import database_sync_to_async

    user = await database_sync_to_async(User.objects.create_user)(
        username="sock", email="s@x.com", password="StrongPass123!"
    )
    site = await database_sync_to_async(Site.objects.create)(
        name="S", domain="sock.example.com"
    )
    good_token = await database_sync_to_async(
        lambda: str(RefreshToken.for_user(user).access_token)
    )()

    denied = WebsocketCommunicator(application, f"/ws/sites/{site.pk}/progress/")
    connected, _ = await denied.connect()
    assert connected is False
    await denied.disconnect()

    allowed = WebsocketCommunicator(
        application, f"/ws/sites/{site.pk}/progress/?token={good_token}"
    )
    connected, _ = await allowed.connect()
    assert connected is True
    first = await allowed.receive_json_from()
    assert first["stage"] == "connected"
    await allowed.disconnect()
