"""Phase 11 tests: multi-alias hostnames + custom-domain verification."""

import pytest
from django.contrib.auth import get_user_model
from django.test import RequestFactory, override_settings

from apps.audit.models import AuditLog
from apps.builder.middleware import BuilderDomainMiddleware
from apps.sites.models import SiteDomain

User = get_user_model()
BASE = "sites.example.com"


@pytest.fixture(autouse=True)
def _clear_cache():
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def admin_client(client, db):
    User.objects.create_user(
        username="aliaser", email="a@x.com", password="StrongPass123!"
    )
    login = client.post(
        "/api/v1/auth/login/", {"username": "aliaser", "password": "StrongPass123!"}
    )
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {login.json()['access']}"
    return client


def make_built(client, **kwargs):
    payload = {
        "name": "My Shop",
        "type": "built",
        "integration_mode": "connector",
        "subdomain": "myshop",
    }
    payload.update(kwargs)
    return client.post("/api/v1/sites/", payload, content_type="application/json")


def domains_url(site_id, suffix=""):
    return f"/api/v1/sites/{site_id}/domains/{suffix}"


@override_settings(PLATFORM_BASE_DOMAIN=BASE)
def test_add_managed_alias_auto_verified(admin_client):
    site_id = make_built(admin_client).json()["id"]
    resp = admin_client.post(
        domains_url(site_id),
        {"hostname": "extra." + BASE},
        content_type="application/json",
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data["kind"] == "managed"
    assert data["verification_status"] == "verified"
    assert data["dns"] is None


@override_settings(
    PLATFORM_BASE_DOMAIN=BASE, PLATFORM_INGRESS_HOST="ingress.example.com"
)
def test_add_custom_alias_pending_with_dns_instructions(admin_client):
    site_id = make_built(admin_client).json()["id"]
    resp = admin_client.post(
        domains_url(site_id),
        {"hostname": "acme-store.com"},
        content_type="application/json",
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data["kind"] == "custom"
    assert data["verification_status"] == "pending"
    assert data["dns"]["cname_target"] == "ingress.example.com"
    assert data["dns"]["txt_value"].startswith("cms-verify=")
    assert AuditLog.objects.filter(action="updated").exists()


@override_settings(PLATFORM_BASE_DOMAIN=BASE)
def test_add_duplicate_and_connected_rejected(admin_client):
    site_id = make_built(admin_client).json()["id"]
    # Same as the site's own canonical address.
    resp = admin_client.post(
        domains_url(site_id),
        {"hostname": f"myshop.{BASE}"},
        content_type="application/json",
    )
    assert resp.status_code == 400
    connected = admin_client.post(
        "/api/v1/sites/",
        {"name": "C", "type": "connected", "domain": "external.example.org"},
        content_type="application/json",
    ).json()["id"]
    resp = admin_client.post(
        domains_url(connected),
        {"hostname": "other.example.org"},
        content_type="application/json",
    )
    assert resp.status_code == 400


class FakeRdata:
    def __init__(self, text):
        self.strings = [text.encode()]


@override_settings(PLATFORM_BASE_DOMAIN=BASE)
def test_check_verifies_and_alias_serves(admin_client, monkeypatch):
    from apps.sites import connect

    site_id = make_built(admin_client).json()["id"]
    alias_id = admin_client.post(
        domains_url(site_id),
        {"hostname": "acme-store.com"},
        content_type="application/json",
    ).json()["id"]

    def fake_resolve(host, rdtype, lifetime=10):
        assert rdtype == "TXT"
        token = SiteDomain.objects.get(pk=alias_id).verification_token
        return [FakeRdata(f"cms-verify={token}")]

    monkeypatch.setattr(connect.dns.resolver, "resolve", fake_resolve)
    resp = admin_client.post(domains_url(site_id, f"{alias_id}/check/"))
    assert resp.status_code == 200, resp.json()
    assert resp.json()["verification_status"] == "verified"
    assert AuditLog.objects.filter(action="verified").exists()

    # Alias host now renders (site still pending -> activate first).
    admin_client.post(f"/api/v1/sites/{site_id}/activate/")
    factory = RequestFactory()
    seen = {}

    def get_response(request):
        seen["site"] = request.built_site
        return None

    with override_settings(ALLOWED_HOSTS=["*"]):
        BuilderDomainMiddleware(get_response)(
            factory.get("/", HTTP_HOST="acme-store.com")
        )
    assert seen["site"] is not None and seen["site"].pk == site_id


@override_settings(PLATFORM_BASE_DOMAIN=BASE)
def test_failed_check_keeps_alias_dark(admin_client, monkeypatch):
    from apps.sites import connect

    site_id = make_built(admin_client).json()["id"]
    alias_id = admin_client.post(
        domains_url(site_id),
        {"hostname": "acme-store.com"},
        content_type="application/json",
    ).json()["id"]

    def fake_resolve(host, rdtype, lifetime=10):
        raise Exception("NXDOMAIN")

    monkeypatch.setattr(connect.dns.resolver, "resolve", fake_resolve)
    resp = admin_client.post(domains_url(site_id, f"{alias_id}/check/"))
    assert resp.status_code == 200
    assert resp.json()["verification_status"] == "failed"

    admin_client.post(f"/api/v1/sites/{site_id}/activate/")
    factory = RequestFactory()
    seen = {}

    def get_response(request):
        seen["site"] = request.built_site
        return None

    with override_settings(ALLOWED_HOSTS=["*"]):
        BuilderDomainMiddleware(get_response)(
            factory.get("/", HTTP_HOST="acme-store.com")
        )
    assert seen["site"] is None


@override_settings(PLATFORM_BASE_DOMAIN=BASE)
def test_make_primary_switches_canonical(admin_client, monkeypatch):
    from apps.sites import connect

    site_id = make_built(admin_client).json()["id"]
    alias_id = admin_client.post(
        domains_url(site_id),
        {"hostname": "acme-store.com"},
        content_type="application/json",
    ).json()["id"]

    def fake_resolve(host, rdtype, lifetime=10):
        token = SiteDomain.objects.get(pk=alias_id).verification_token
        return [FakeRdata(f"cms-verify={token}")]

    monkeypatch.setattr(connect.dns.resolver, "resolve", fake_resolve)
    admin_client.post(domains_url(site_id, f"{alias_id}/check/"))
    resp = admin_client.post(domains_url(site_id, f"{alias_id}/make-primary/"))
    assert resp.status_code == 200, resp.json()
    assert resp.json()["domain"] == "acme-store.com"
    primaries = SiteDomain.objects.filter(site_id=site_id, is_primary=True)
    assert [a.hostname for a in primaries] == ["acme-store.com"]

    # Unverified aliases cannot become primary.
    other = admin_client.post(
        domains_url(site_id),
        {"hostname": "second.example.org"},
        content_type="application/json",
    ).json()["id"]
    resp = admin_client.post(domains_url(site_id, f"{other}/make-primary/"))
    assert resp.status_code == 400


@override_settings(PLATFORM_BASE_DOMAIN=BASE)
def test_primary_cannot_be_deleted(admin_client):
    site_id = make_built(admin_client).json()["id"]
    aliases = admin_client.get(domains_url(site_id)).json()
    primary = next(a for a in aliases if a["is_primary"])
    resp = admin_client.delete(domains_url(site_id, f"{primary['id']}/"))
    assert resp.status_code == 400

    extra = admin_client.post(
        domains_url(site_id),
        {"hostname": "extra." + BASE},
        content_type="application/json",
    ).json()["id"]
    resp = admin_client.delete(domains_url(site_id, f"{extra}/"))
    assert resp.status_code == 200
