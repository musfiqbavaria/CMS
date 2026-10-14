"""Phase 12 tests: starter templates, homepage selection, publish guards."""

import pytest
from django.contrib.auth import get_user_model

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
        username="builder", email="b@x.com", password="StrongPass123!"
    )
    login = client.post(
        "/api/v1/auth/login/", {"username": "builder", "password": "StrongPass123!"}
    )
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {login.json()['access']}"
    return client


@pytest.fixture
def site(db):
    return Site.objects.create(
        name="Shop",
        domain="shop12.test",
        type=Site.Types.BUILT,
        status=Site.Statuses.ACTIVE,
    )


def base(site):
    return f"/api/v1/sites/{site.pk}/builder"


def test_list_templates(admin_client, site):
    resp = admin_client.get(base(site) + "/templates/")
    assert resp.status_code == 200
    slugs = {t["slug"] for t in resp.json()}
    assert {"business", "portfolio", "store"} <= slugs


def test_apply_business_template(admin_client, site):
    resp = admin_client.post(
        base(site) + "/templates/apply/",
        {"template": "business"},
        content_type="application/json",
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data["pages"] == 2 and data["sections"] == 5 and data["menu"] is True
    site.refresh_from_db()
    assert site.homepage is not None and site.homepage.slug == "home"
    assert site.menus.get().items.count() == 2
    home = admin_client.get("/", HTTP_HOST="shop12.test")
    assert home.status_code == 200
    assert "We help your business grow" in home.content.decode()


def test_apply_refuses_nonempty_without_force(admin_client, site):
    admin_client.post(
        base(site) + "/templates/apply/",
        {"template": "portfolio"},
        content_type="application/json",
    )
    resp = admin_client.post(
        base(site) + "/templates/apply/",
        {"template": "business"},
        content_type="application/json",
    )
    assert resp.status_code == 400
    resp = admin_client.post(
        base(site) + "/templates/apply/",
        {"template": "business", "force": True},
        content_type="application/json",
    )
    assert resp.status_code == 201, resp.json()
    assert site.pages.count() == 2
    assert site.menus.count() == 1


def test_apply_unknown_or_connected_rejected(admin_client, site):
    resp = admin_client.post(
        base(site) + "/templates/apply/",
        {"template": "nope"},
        content_type="application/json",
    )
    assert resp.status_code == 400
    connected = Site.objects.create(
        name="C", domain="c12.test", type=Site.Types.CONNECTED
    )
    resp = admin_client.post(
        f"/api/v1/sites/{connected.pk}/builder/templates/apply/",
        {"template": "business"},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_homepage_selection_and_guards(admin_client, site):
    about = admin_client.post(
        base(site) + "/pages/", {"title": "About", "status": "published"}
    ).json()
    # Draft pages cannot become the homepage.
    draft = admin_client.post(base(site) + "/pages/", {"title": "Draft"}).json()
    resp = admin_client.post(
        base(site) + "/homepage/",
        {"page": draft["id"]},
        content_type="application/json",
    )
    assert resp.status_code == 400
    resp = admin_client.post(
        base(site) + "/homepage/",
        {"page": about["id"]},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp.json()["homepage"] == about["id"]
    home = admin_client.get("/", HTTP_HOST="shop12.test")
    assert "About" in home.content.decode()
    # The homepage cannot be deleted while selected.
    resp = admin_client.delete(f"{base(site)}/pages/{about['id']}/")
    assert resp.status_code == 400
    resp = admin_client.delete(f"{base(site)}/pages/{draft['id']}/")
    assert resp.status_code == 204
