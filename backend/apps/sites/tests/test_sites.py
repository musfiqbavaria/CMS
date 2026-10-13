"""Phase 3 tests: site CRUD, filters, bulk actions, and audit trail."""

import pytest
from django.contrib.auth import get_user_model

from apps.audit.models import AuditLog
from apps.sites.models import Site

User = get_user_model()
SITES_URL = "/api/v1/sites/"
LOGS_URL = "/api/v1/audit/logs/"


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


def make_site(client, **kwargs):
    payload = {
        "name": "Example",
        "domain": "example.com",
        "type": "connected",
        "integration_mode": "connector",
    }
    payload.update(kwargs)
    return client.post(SITES_URL, payload, content_type="application/json")


def test_anon_denied(client, db):
    assert client.get(SITES_URL).status_code == 401
    assert client.get(LOGS_URL).status_code == 401


def test_create_site_and_audit(admin_client):
    resp = make_site(admin_client, domain="shop.example.com")
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data["site_key"] and data["status"] == "pending"
    assert data["verification_status"] == "pending"
    log = AuditLog.objects.get(action="created")
    assert log.after["domain"] == "shop.example.com"
    assert log.before == {}
    assert log.actor.username == "owner"


def test_duplicate_domain_rejected(admin_client):
    assert make_site(admin_client, domain="dup.example.com").status_code == 201
    resp = make_site(admin_client, name="Other", domain="https://DUP.example.com/path")
    assert resp.status_code == 400
    assert "domain" in resp.json()


def test_update_site_and_audit(admin_client):
    site_id = make_site(admin_client).json()["id"]
    resp = admin_client.patch(
        f"{SITES_URL}{site_id}/", {"name": "Renamed"}, content_type="application/json"
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"
    log = AuditLog.objects.get(action="updated")
    assert log.before["name"] == "Example"
    assert log.after["name"] == "Renamed"


def test_activate_deactivate(admin_client):
    site_id = make_site(admin_client).json()["id"]
    assert (
        admin_client.post(f"{SITES_URL}{site_id}/activate/").json()["status"]
        == "active"
    )
    assert (
        admin_client.post(f"{SITES_URL}{site_id}/deactivate/").json()["status"]
        == "inactive"
    )
    assert AuditLog.objects.filter(action__in=["activated", "deactivated"]).count() == 2


def test_delete_keeps_audit(admin_client):
    site_id = make_site(admin_client).json()["id"]
    assert admin_client.delete(f"{SITES_URL}{site_id}/").status_code == 204
    assert Site.objects.count() == 0
    log = AuditLog.objects.get(action="deleted")
    assert log.site is None  # FK nulled, snapshot survives
    assert log.site_display == "example.com"
    assert log.before["domain"] == "example.com"


def test_list_search_filter_ordering_pagination(admin_client):
    make_site(admin_client, name="Alpha", domain="alpha.example.com", type="built")
    make_site(admin_client, name="Beta", domain="beta.example.com")
    resp = admin_client.get(SITES_URL + "?search=alpha")
    assert resp.json()["count"] == 1
    resp = admin_client.get(SITES_URL + "?type=built")
    assert resp.json()["count"] == 1
    resp = admin_client.get(SITES_URL + "?ordering=name")
    names = [r["name"] for r in resp.json()["results"]]
    assert names == sorted(names)
    resp = admin_client.get(SITES_URL + "?page=2&page_size=1")
    assert resp.json()["count"] == 2
    assert len(resp.json()["results"]) == 1


def test_bulk_actions(admin_client):
    ids = [
        make_site(admin_client, name=f"S{i}", domain=f"s{i}.example.com").json()["id"]
        for i in range(3)
    ]
    resp = admin_client.post(
        f"{SITES_URL}bulk/",
        {"action": "activate", "ids": ids},
        content_type="application/json",
    )
    assert resp.json() == {"processed": 3, "missing": 0}
    assert Site.objects.filter(status="active").count() == 3
    resp = admin_client.post(
        f"{SITES_URL}bulk/",
        {"action": "delete", "ids": ids[:2]},
        content_type="application/json",
    )
    assert resp.json()["processed"] == 2
    assert Site.objects.count() == 1
    assert AuditLog.objects.filter(action="activated").count() == 3
    assert AuditLog.objects.filter(action="deleted").count() == 2


def test_audit_log_filter_by_site(admin_client):
    site_id = make_site(admin_client).json()["id"]
    other_id = make_site(admin_client, name="Other", domain="other.example.com").json()[
        "id"
    ]
    resp = admin_client.get(f"{LOGS_URL}?site={site_id}")
    assert resp.json()["count"] == 1
    assert resp.json()["results"][0]["site"] == site_id
    resp = admin_client.get(f"{LOGS_URL}?site={other_id}")
    assert resp.json()["count"] == 1
