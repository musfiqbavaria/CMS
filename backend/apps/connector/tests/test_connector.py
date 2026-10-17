"""Phase 6 tests: public config (cache/ETag/gating), loader, proxy, mappings, purge."""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.connector.models import SelectorMapping
from apps.connector.services import cache_key
from apps.sites.models import Site

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
        username="owner", email="o@x.com", password="StrongPass123!"
    )
    login = client.post(
        "/api/v1/auth/login/", {"username": "owner", "password": "StrongPass123!"}
    )
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {login.json()['access']}"
    return client


@pytest.fixture
def site(db):
    from apps.content.services import get_or_create_config, publish

    s = Site.objects.create(
        name="Shop", domain="shop.example.com", status=Site.Statuses.ACTIVE
    )
    cfg = get_or_create_config(s)
    cfg.draft["hero"]["heading"] = "Buy now"
    cfg.save()
    publish(actor=None, site=s)
    return s


def config_url(site):
    return f"/connector/v1/config/{site.site_key}/"


def test_unknown_and_inactive_keys_404(client, site):
    assert client.get("/connector/v1/config/badkey/").status_code == 404
    site.status = Site.Statuses.INACTIVE
    site.save()
    assert client.get(config_url(site)).status_code == 404


def test_config_payload_and_etag(client, site):
    first = client.get(config_url(site))
    assert first.status_code == 200
    assert first["Access-Control-Allow-Origin"] == "*"
    body = first.json()
    assert body["data"]["hero"]["heading"] == "Buy now"
    assert len(body["mappings"]) == len(SelectorMapping.Keys)
    # Unverified sites must not receive admin-authored code.
    assert body["data"]["custom_js"] == ""
    etag = first["ETag"]
    second = client.get(config_url(site), HTTP_IF_NONE_MATCH=etag)
    assert second.status_code == 304


def test_verified_site_receives_custom_js(client, site):
    site.verification_status = Site.VerificationStatuses.VERIFIED
    site.save()
    from apps.content.services import get_or_create_config, publish

    cfg = get_or_create_config(site)
    cfg.draft["custom"]["js"] = "console.log(1)"
    cfg.save()
    publish(actor=None, site=site)
    body = client.get(config_url(site)).json()
    assert body["verified"] is True
    assert body["data"]["custom_js"] == "console.log(1)"


def test_published_page_text_blocks_ship_with_the_payload(client, site):
    from apps.content.services import get_or_create_config, publish

    cfg = get_or_create_config(site)
    cfg.draft["pages"] = {
        "blocks": [
            {
                "id": "b0123456789abcdef",
                "path": "/jobs/",
                "label": "Jobs banner heading",
                "selector": "section.public-hero h1",
                "text": "Find your next opportunity",
            },
            {"id": "not-a-block", "path": "/x", "selector": "h1", "text": "nope"},
            {"id": "bffffffffff", "path": "relative", "selector": "h1", "text": "nope"},
            {"id": "b1111111111", "path": "/x", "selector": "", "text": "nope"},
        ]
    }
    cfg.save()
    publish(actor=None, site=site)
    body = client.get(config_url(site)).json()
    assert body["blocks"] == [
        {
            "id": "b0123456789abcdef",
            "path": "/jobs",
            "label": "Jobs banner heading",
            "selector": "section.public-hero h1",
            "text": "Find your next opportunity",
        }
    ]


def test_publish_purges_cache(admin_client, site):
    from django.core.cache import cache

    client = admin_client
    primed = client.get(config_url(site))
    assert primed.status_code == 200
    assert cache.get(cache_key(site.site_key)) is not None
    with TestCase.captureOnCommitCallbacks(execute=True):
        assert (
            client.post(f"/api/v1/sites/{site.pk}/config/publish/", {}).status_code
            == 200
        )
    assert cache.get(cache_key(site.site_key)) is None


def test_rollback_reflects_immediately(client, site):
    from apps.connector.tasks import purge_connector_cache
    from apps.content.services import get_or_create_config, publish

    cfg = get_or_create_config(site)
    cfg.draft["hero"]["heading"] = "Second"
    cfg.save()
    publish(actor=None, site=site)
    purge_connector_cache.apply(args=[site.pk]).get()
    assert client.get(config_url(site)).json()["data"]["hero"]["heading"] == "Second"
    first_version = site.versions.order_by("version_no").first()
    from apps.content.services import rollback

    rollback(actor=None, site=site, version_id=first_version.pk)
    purge_connector_cache.apply(args=[site.pk]).get()
    resp = client.get(config_url(site))
    assert resp.status_code == 200
    assert resp.json()["data"]["hero"]["heading"] == "Buy now"


def test_loader_js(client, db):
    resp = client.get("/connector/v1/loader.js?site=abc")
    assert resp.status_code == 200
    assert "javascript" in resp["Content-Type"]
    assert resp["Access-Control-Allow-Origin"] == "*"
    assert "data-cms-site" in resp.content.decode()
    # Page text blocks apply only on their own page.
    assert b"applyPageBlocks" in resp.content
    assert client.get("/connector/v1/loader.js").status_code == 400


def test_proxy_gating_and_injection(client, site):
    url = f"/connector/v1/proxy/{site.site_key}/"
    assert client.get(url).status_code == 400  # connector mode by default
    site.integration_mode = Site.IntegrationModes.PROXY
    site.save()
    assert client.get(url).status_code == 403  # unverified
    site.verification_status = Site.VerificationStatuses.VERIFIED
    site.save()

    class FakeResult:
        text = "<html><head><title>T</title></head><body><h1>Hi</h1></body></html>"

    with patch("apps.connector.views.safe_fetch", return_value=FakeResult()):
        resp = client.get(url)
    assert resp.status_code == 200
    body = resp.content.decode()
    assert f"/connector/v1/loader.js?site={site.site_key}" in body
    assert '<base href="https://shop.example.com/">' in body


def test_preview_renders_verified_site_without_framing_blockers(client, site):
    url = f"/connector/v1/preview/{site.site_key}/"
    assert client.get(url).status_code == 403  # unverified
    site.verification_status = Site.VerificationStatuses.VERIFIED
    site.save()

    class FakeResult:
        text = (
            '<html><head><meta http-equiv="X-Frame-Options" content="DENY">'
            '<meta http-equiv="Content-Security-Policy" content="frame-ancestors \'none\'">'
            "<title>T</title></head>"
            '<body><img src="/logo.png"><h1>Hi</h1></body></html>'
        )

    with patch("apps.connector.views.safe_fetch", return_value=FakeResult()):
        resp = client.get(url)
    assert resp.status_code == 200
    body = resp.content.decode()
    assert "X-Frame-Options" not in body
    assert "frame-ancestors" not in body
    assert '<base href="https://shop.example.com/">' in body
    # The published connector runs in preview mode so the preview matches the
    # live site; the website's own script tags stay nonce-blocked.
    assert f"/connector/v1/loader.js?site={site.site_key}" in body
    assert 'data-cms-preview="1"' in body
    assert resp["Cache-Control"] == "no-store"


def test_preview_rejects_unknown_built_and_bad_path(client, site):
    assert client.get("/connector/v1/preview/nope/").status_code == 404
    site.verification_status = Site.VerificationStatuses.VERIFIED
    site.type = Site.Types.BUILT
    site.save()
    assert client.get(f"/connector/v1/preview/{site.site_key}/").status_code == 400
    site.type = Site.Types.CONNECTED
    site.save()
    resp = client.get(f"/connector/v1/preview/{site.site_key}/?path=https://evil.test/")
    assert resp.status_code == 400


def test_preview_base_tracks_the_nested_page(client, site):
    site.verification_status = Site.VerificationStatuses.VERIFIED
    site.save()

    class FakeResult:
        text = "<html><head></head><body>Nested</body></html>"

    with patch("apps.connector.views.safe_fetch", return_value=FakeResult()):
        resp = client.get(
            f"/connector/v1/preview/{site.site_key}/", {"path": "/products/x"}
        )
    assert resp.status_code == 200
    assert '<base href="https://shop.example.com/products/">' in resp.content.decode()


def test_mapping_crud(admin_client, site):
    base = f"/api/v1/sites/{site.pk}/mappings/"
    # Prime the default mapping set through the public config endpoint.
    admin_client.get(config_url(site))
    assert len(admin_client.get(base).json()) == len(SelectorMapping.Keys)
    mapping = site.mappings.first()
    resp = admin_client.patch(
        f"{base}{mapping.pk}/",
        {"selector": ".custom h1"},
        content_type="application/json",
    )
    assert resp.json()["selector"] == ".custom h1"
    dup = admin_client.post(base, {"key": mapping.key, "selector": "x"})
    assert dup.status_code == 400
    reset = admin_client.post(base + "reset-defaults/")
    assert len(reset.json()) == len(SelectorMapping.Keys)
    assert admin_client.get(base).status_code == 200


def test_config_requires_no_auth(client, site):
    assert client.get(config_url(site)).status_code == 200
