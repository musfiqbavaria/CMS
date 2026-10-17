"""Delivery observations are bounded, private, and never inferred from publishing."""

import json
import time
import uuid
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.connector.delivery import TICKET_SALT, issue_ticket, private_path
from apps.connector.models import DeliveryReport, SelectorMapping
from apps.content.services import get_or_create_config, publish, rollback, update_draft
from apps.sites.models import Site

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def report_settings(settings):
    settings.CMS_PUBLIC_URL = "https://cms.example.com"
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def site():
    website = Site.objects.create(
        name="Delivery test",
        domain="shop.example.com",
        status="active",
        verification_status="verified",
    )
    publish(site=website, actor=None)
    return website


@pytest.fixture
def admin():
    user = get_user_model().objects.create_user(username="report-admin", role="admin")
    client = APIClient()
    client.force_authenticate(user)
    return client


def report_url(site):
    return f"/connector/v1/reports/{site.site_key}/"


def status_url(site):
    return f"/api/v1/sites/{site.pk}/delivery/"


def payload(client, site, **changes):
    config = client.get(f"/connector/v1/config/{site.site_key}/").json()
    return {
        "token": issue_ticket(site),
        "version": config["published_version"],
        "revision": config["delivery_revision"],
        "state": "ready",
        "page_path": "/",
        "applied": ["metadata", "hero_heading"],
        "unmatched": [],
        "errors": [],
        **changes,
    }


def send(client, site, data=None, origin="https://shop.example.com"):
    return client.post(
        report_url(site),
        data=json.dumps(data if data is not None else payload(client, site)),
        content_type="text/plain",
        HTTP_ORIGIN=origin,
    )


def test_publishing_never_fabricates_a_browser_success(client, admin, site):
    result = admin.get(status_url(site))
    assert result.status_code == 200
    assert result["Cache-Control"] == "no-store"
    assert result.json()["state"] == "waiting"
    assert result.json()["published_version"] == 1
    assert result.json()["latest_report"] is None
    assert DeliveryReport.objects.count() == 0
    assert client.get(status_url(site)).status_code == 401


def test_dashboard_denies_non_admin_and_missing_site(site):
    user = get_user_model().objects.create_user(username="viewer", role="editor")
    client = APIClient()
    client.force_authenticate(user)
    assert client.get(status_url(site)).status_code == 403
    client.force_authenticate(
        get_user_model().objects.create_user(username="admin", role="admin")
    )
    assert client.get("/api/v1/sites/99999/delivery/").status_code == 404


def test_current_report_roundtrip_and_replay_is_not_a_new_observation(
    client, admin, site
):
    data = payload(client, site, applied=["metadata", "metadata", "hero_heading"])
    response = send(client, site, data)
    assert response.status_code == 202
    assert response["Access-Control-Allow-Origin"] == "*"
    assert response.json()["accepted"] is True
    report = DeliveryReport.objects.get()
    assert report.applied == ["metadata", "hero_heading"]
    assert admin.get(status_url(site)).json()["state"] == "reported"
    assert send(client, site, data).json()["accepted"] is False
    assert DeliveryReport.objects.count() == 1
    assert DeliveryReport.objects.get().received_at == report.received_at
    assert "token" not in admin.get(status_url(site)).json()["latest_report"]


def test_preview_cannot_confirm_live_delivery(client, admin, site):
    assert send(client, site, origin="https://cms.example.com").status_code == 202
    data = admin.get(status_url(site)).json()
    assert data["state"] == "waiting"
    assert data["latest_report"] is None
    assert data["latest_preview"]["context"] == "preview"


def test_proxy_remains_preview_when_cms_and_site_share_an_origin(
    client, admin, site, settings
):
    settings.CMS_PUBLIC_URL = "https://shop.example.com"
    data = payload(client, site, page_path="/connector/v1/proxy/key/")
    assert send(client, site, data).status_code == 202
    assert admin.get(status_url(site)).json()["latest_report"] is None
    assert DeliveryReport.objects.get().context == "preview"


@pytest.mark.parametrize(
    "origin",
    [
        "",
        "null",
        "https://evil.example.com",
        "https://shop.example.com.evil.test",
        "https://shop.example.com:444",
        "https://shop.example.com/private",
    ],
)
def test_unrelated_and_opaque_origins_are_rejected(client, site, origin):
    assert send(client, site, origin=origin).status_code == 403
    assert not DeliveryReport.objects.exists()


@pytest.mark.parametrize(
    "kind", ["tampered", "expired", "other-site", "future", "bad-time"]
)
def test_ticket_scope_integrity_and_lifetime(client, site, kind):
    ticket = {"site": site.pk, "attempt": uuid.uuid4().hex, "issued_at": time.time()}
    if kind == "expired":
        ticket["issued_at"] -= 700
    elif kind == "other-site":
        ticket["site"] += 1
    elif kind == "future":
        ticket["issued_at"] += 120
    elif kind == "bad-time":
        ticket["issued_at"] = "NaN"
    token = signing.dumps(ticket, salt=TICKET_SALT)
    if kind == "tampered":
        token += "broken"
    assert send(client, site, payload(client, site, token=token)).status_code == 403
    assert not DeliveryReport.objects.exists()


def test_foreign_versions_and_malformed_reports_are_rejected(client, site):
    assert send(client, site, payload(client, site, version=999)).status_code == 400
    assert (
        send(client, site, payload(client, site, applied=["not-a-field"])).status_code
        == 400
    )
    assert (
        send(
            client,
            site,
            payload(
                client,
                site,
                state="ready",
                errors=[{"key": "metadata", "message": "failed"}],
            ),
        ).status_code
        == 400
    )
    assert (
        client.post(
            report_url(site), data="{broken", content_type="text/plain"
        ).status_code
        == 400
    )
    assert (
        client.post(
            report_url(site), data="x" * 33000, content_type="text/plain"
        ).status_code
        == 413
    )
    assert not DeliveryReport.objects.exists()


def test_partial_error_mapping_change_republish_and_rollback(client, admin, site):
    first_version = get_or_create_config(site).published_version_id
    partial = payload(
        client,
        site,
        state="partial",
        unmatched=[{"key": "hero_heading", "selector": ".missing"}],
    )
    assert send(client, site, partial).status_code == 202
    assert admin.get(status_url(site)).json()["state"] == "partial"
    mapping = SelectorMapping.objects.get(site=site, key="hero_heading")
    mapping.selector = ".new-selector"
    mapping.save()
    assert admin.get(status_url(site)).json()["state"] == "changed"
    assert send(client, site).status_code == 202
    assert admin.get(status_url(site)).json()["state"] == "reported"
    update_draft(site=site, actor=None, patch={"hero": {"heading": "New draft"}})
    publish(site=site, actor=None)
    assert admin.get(status_url(site)).json()["state"] == "outdated"
    rollback(site=site, actor=None, version_id=first_version)
    # Rollback compares exact version identity, never version-number magnitude.
    assert admin.get(status_url(site)).json()["state"] == "reported"
    error = payload(
        client,
        site,
        state="error",
        version=None,
        revision="",
        applied=[],
        errors=[{"key": "configuration", "message": "Config HTTP 503"}],
    )
    assert send(client, site, error).status_code == 202
    assert admin.get(status_url(site)).json()["state"] == "error"


def test_delayed_older_attempt_cannot_replace_newer_load(client, admin, site):
    old = payload(
        client,
        site,
        token=signing.dumps(
            {
                "site": site.pk,
                "attempt": uuid.uuid4().hex,
                "issued_at": time.time() - 20,
            },
            salt=TICKET_SALT,
        ),
        state="error",
        errors=[{"key": "configuration", "message": "old failure"}],
    )
    send(client, site)
    send(client, site, old)
    assert DeliveryReport.objects.count() == 2
    assert admin.get(status_url(site)).json()["state"] == "reported"


def test_old_ready_report_is_explicitly_stale(client, admin, site):
    send(client, site)
    DeliveryReport.objects.update(received_at=timezone.now() - timedelta(minutes=16))
    assert admin.get(status_url(site)).json()["state"] == "stale"


def test_rate_and_history_limits(client, site):
    with patch("apps.connector.delivery.HISTORY_LIMIT", 3), patch(
        "apps.connector.delivery.REPORT_LIMIT", 4
    ):
        for _ in range(4):
            assert send(client, site).status_code == 202
        assert DeliveryReport.objects.count() == 3
        response = send(client, site)
        assert response.status_code == 429
        assert response["Retry-After"] == "60"


def test_cache_failure_has_bounded_database_fallback(client, site):
    data = payload(client, site)
    with patch(
        "apps.connector.delivery.cache.add", side_effect=RuntimeError("Redis down")
    ):
        assert send(client, site, data).status_code == 202


def test_only_path_is_persisted_and_long_segments_are_redacted(client, site):
    assert (
        send(
            client,
            site,
            payload(
                client,
                site,
                page_path="/orders/" + "a" * 40 + "?access_token=secret#private",
            ),
        ).status_code
        == 202
    )
    assert DeliveryReport.objects.get().page_path == "/orders/:id"
    assert private_path("//evil.example.com/path") == "/"
    assert private_path("/hello%0aworld") == "/helloworld"


def test_loader_tickets_are_fresh_without_destabilizing_config_etags(client, site):
    url = f"/connector/v1/loader.js?site={site.site_key}"
    before = client.get(f"/connector/v1/config/{site.site_key}/")
    first, second = client.get(url), client.get(url)
    assert first["Cache-Control"] == "no-store"
    assert b"data-cms-report-token" in first.content
    assert first.content != second.content
    after = client.get(
        f"/connector/v1/config/{site.site_key}/", HTTP_IF_NONE_MATCH=before["ETag"]
    )
    assert after.status_code == 304
    assert "token" not in before.json()


@pytest.mark.parametrize(
    "field,value,state",
    [
        ("status", "inactive", "inactive"),
        ("verification_status", "pending", "unverified"),
        ("type", "built", "unsupported"),
    ],
)
def test_non_reporting_site_states_and_public_endpoint_gating(
    client, admin, site, field, value, state
):
    setattr(site, field, value)
    site.save()
    assert admin.get(status_url(site)).json()["state"] == state
    assert send(client, site, {"token": "anything"}).status_code == 404


def test_unpublished_site_is_not_waiting_for_impossible_success(admin):
    site = Site.objects.create(
        name="Not published",
        domain="new.example.com",
        status="active",
        verification_status="verified",
    )
    assert admin.get(status_url(site)).json()["state"] == "unpublished"
