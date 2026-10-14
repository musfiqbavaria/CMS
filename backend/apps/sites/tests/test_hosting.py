"""Phase 10 tests: hosted addressing (free subdomains + custom domains)."""

import pytest
from django.contrib.auth import get_user_model
from django.test import RequestFactory, override_settings

from apps.builder.middleware import BuilderDomainMiddleware
from apps.sites import hosting
from apps.sites.models import Site

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
        username="hoster", email="h@x.com", password="StrongPass123!"
    )
    login = client.post(
        "/api/v1/auth/login/", {"username": "hoster", "password": "StrongPass123!"}
    )
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {login.json()['access']}"
    return client


def post_site(client, **kwargs):
    payload = {
        "name": "Shop",
        "domain": "shop-example.com",
        "type": "built",
        "integration_mode": "connector",
    }
    payload.update(kwargs)
    return client.post(SITES_URL, payload, content_type="application/json")


def test_normalize_and_managed_detection():
    assert hosting.normalize_hostname("https://Example.COM/path ") == "example.com"
    with override_settings(PLATFORM_BASE_DOMAIN="sites.example.com"):
        assert hosting.is_managed_hostname("shop.sites.example.com")
        assert hosting.subdomain_label("shop.sites.example.com") == "shop"
        assert not hosting.is_managed_hostname("example.com")
    with override_settings(PLATFORM_BASE_DOMAIN=""):
        assert not hosting.is_managed_hostname("shop.sites.example.com")


@override_settings(PLATFORM_BASE_DOMAIN="sites.example.com")
def test_create_built_site_with_subdomain(admin_client):
    payload = {
        "name": "My Shop",
        "type": "built",
        "integration_mode": "connector",
        "subdomain": "myshop",
    }
    resp = admin_client.post(SITES_URL, payload, content_type="application/json")
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data["domain"] == "myshop.sites.example.com"
    assert data["is_managed"] is True
    assert data["public_url"] == "https://myshop.sites.example.com"


@override_settings(PLATFORM_BASE_DOMAIN="sites.example.com")
def test_create_built_with_name_only_auto_allocates(admin_client):
    resp = admin_client.post(
        SITES_URL,
        {"name": "My Awesome Shop", "type": "built"},
        content_type="application/json",
    )
    assert resp.status_code == 201, resp.json()
    assert resp.json()["domain"] == "my-awesome-shop.sites.example.com"
    # A colliding name gets a numeric suffix.
    resp = admin_client.post(
        SITES_URL,
        {"name": "My Awesome Shop!", "type": "built"},
        content_type="application/json",
    )
    assert resp.status_code == 201, resp.json()
    assert resp.json()["domain"] == "my-awesome-shop-2.sites.example.com"


@override_settings(PLATFORM_BASE_DOMAIN="sites.example.com")
def test_create_built_site_with_custom_domain(admin_client):
    resp = post_site(admin_client, domain="acme-store.com")
    assert resp.status_code == 201, resp.json()
    assert resp.json()["is_managed"] is False


@override_settings(PLATFORM_BASE_DOMAIN="")
def test_subdomain_rejected_without_base(admin_client):
    resp = admin_client.post(
        SITES_URL,
        {"name": "S", "type": "built", "subdomain": "shop"},
        content_type="application/json",
    )
    assert resp.status_code == 400
    assert "subdomain" in resp.json()


@override_settings(PLATFORM_BASE_DOMAIN="sites.example.com")
def test_subdomain_rejected_for_connected(admin_client):
    resp = admin_client.post(
        SITES_URL,
        {"name": "C", "type": "connected", "subdomain": "shop"},
        content_type="application/json",
    )
    assert resp.status_code == 400


@override_settings(PLATFORM_BASE_DOMAIN="sites.example.com")
def test_reserved_and_apex_rejected(admin_client):
    for bad in ["www", "admin", "api"]:
        resp = admin_client.post(
            SITES_URL,
            {"name": "R", "type": "built", "subdomain": bad},
            content_type="application/json",
        )
        assert resp.status_code == 400, bad
    resp = post_site(admin_client, domain="sites.example.com")
    assert resp.status_code == 400


@override_settings(PLATFORM_BASE_DOMAIN="sites.example.com")
def test_duplicate_managed_rejected(admin_client):
    first = admin_client.post(
        SITES_URL,
        {"name": "A", "type": "built", "subdomain": "dupe"},
        content_type="application/json",
    )
    assert first.status_code == 201
    second = admin_client.post(
        SITES_URL,
        {"name": "B", "type": "built", "subdomain": "dupe"},
        content_type="application/json",
    )
    assert second.status_code == 400


@override_settings(PLATFORM_BASE_DOMAIN="sites.example.com", ALLOWED_HOSTS=["*"])
@pytest.mark.django_db
def test_middleware_resolves_managed_host_case_insensitively():
    site = Site.objects.create(
        name="Case",
        domain="case.sites.example.com",
        type=Site.Types.BUILT,
        status=Site.Statuses.ACTIVE,
    )
    factory = RequestFactory()
    seen = {}

    def get_response(request):
        seen["site"] = request.built_site
        return None

    mw = BuilderDomainMiddleware(get_response)
    mw(factory.get("/", HTTP_HOST="CASE.sites.example.com"))
    assert seen["site"] == site
    # Platform apex never resolves to a site.
    mw(factory.get("/", HTTP_HOST="sites.example.com"))
    assert seen["site"] is None
