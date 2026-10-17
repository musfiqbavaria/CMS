import json
import re
from html import unescape
from unittest.mock import patch

import pytest

from apps.connector.models import SelectorMapping
from apps.sites.models import Site


@pytest.fixture
def site(db):
    return Site.objects.create(
        name="Inspector test",
        domain="shop.example.com",
        verification_status="verified",
        status="active",
    )


def preview(client, site, channel="a" * 32):
    class Result:
        text = (
            '<html><head><meta http-equiv="refresh" content="0;url=/logout">'
            "<title>T</title><script>window.untrusted=true</script></head>"
            "<body><h1>Heading</h1></body></html>"
        )

    with patch("apps.connector.views.safe_fetch", return_value=Result()):
        return client.get(
            f"/connector/v1/preview/{site.site_key}/", {"edit_channel": channel}
        )


def test_nonce_bridge_and_opaque_sandbox_protect_the_admin(client, site):
    response = preview(client, site)
    assert response.status_code == 200
    body = response.content.decode()
    assert "editor-bridge.js" in body
    assert 'http-equiv="refresh"' not in body
    assert response["X-Frame-Options"] == "SAMEORIGIN"
    assert response["Referrer-Policy"] == "no-referrer"
    assert response["Cache-Control"] == "no-store"
    policy = response["Content-Security-Policy"]
    nonce = re.search(r'<script nonce="([^"]+)"', body)[1]
    assert f"script-src 'nonce-{nonce}'" in policy
    for directive in [
        "sandbox allow-scripts",
        "connect-src 'none'",
        "form-action 'none'",
        "frame-src 'none'",
        "frame-ancestors 'self'",
    ]:
        assert directive in policy
    assert "allow-same-origin" not in policy
    assert "unsafe-inline" not in policy.split("script-src ")[1].split(";")[0]
    config = json.loads(
        unescape(re.search(r'data-cms-editor-config="([^"]+)"', body)[1])
    )
    assert config["channel"] == "a" * 32
    assert config["parentOrigin"] == "http://testserver"
    assert any(target["key"] == "hero_heading" for target in config["targets"])
    assert (
        "draft" not in config
    )  # No admin content or session data crosses the frame boundary.


def test_only_enabled_selector_mappings_reach_the_inspector(client, site):
    SelectorMapping.objects.create(
        site=site, key="hero_heading", selector='.custom-title[data-note="safe"]'
    )
    SelectorMapping.objects.create(
        site=site, key="hero_subheading", selector=".disabled", enabled=False
    )
    response = preview(client, site)
    body = response.content.decode()
    config = json.loads(
        unescape(re.search(r'data-cms-editor-config="([^"]+)"', body)[1])
    )
    assert config["targets"] == [
        {
            "key": "hero_heading",
            "label": "Hero heading",
            "selector": '.custom-title[data-note="safe"]',
        }
    ]
    assert ".disabled" not in body


@pytest.mark.parametrize("channel", ["short", "x" * 129, '"><script>alert(1)</script>'])
def test_invalid_channels_are_rejected_before_fetching(client, site, channel):
    with patch("apps.connector.views.safe_fetch") as fetch:
        response = client.get(
            f"/connector/v1/preview/{site.site_key}/", {"edit_channel": channel}
        )
    assert response.status_code == 400
    fetch.assert_not_called()


def test_plain_preview_stays_isolated_without_injecting_a_bridge(client, site):
    response = preview(client, site, "")
    assert response.status_code == 200
    assert "editor-bridge.js" not in response.content.decode()
    assert "sandbox allow-scripts" in response["Content-Security-Policy"]


def test_bridge_is_public_javascript_not_an_admin_or_write_endpoint(client):
    response = client.get("/connector/v1/editor-bridge.js")
    assert response.status_code == 200
    assert "javascript" in response["Content-Type"]
    assert b"cms:editor:configure" in response.content
    assert client.post("/connector/v1/editor-bridge.js").status_code == 405
