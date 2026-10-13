"""Phase 7 tests: builder CRUD, rendering, sitemap, host routing."""

import pytest
from django.contrib.auth import get_user_model

from apps.builder.models import Menu, Page, Product, Section
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
def shop(db):
    return Site.objects.create(
        name="Shop",
        domain="shop.test",
        type=Site.Types.BUILT,
        status=Site.Statuses.ACTIVE,
    )


def builder_base(site):
    return f"/api/v1/sites/{site.pk}/builder/"


def test_builder_rejected_for_connected_sites(admin_client, db):
    connected = Site.objects.create(
        name="C", domain="c.test", type=Site.Types.CONNECTED
    )
    resp = admin_client.post(
        f"/api/v1/sites/{connected.pk}/builder/pages/",
        {"title": "Hi"},
        content_type="application/json",
    )
    assert resp.status_code == 400


def test_page_crud_and_sections(admin_client, shop):
    base = builder_base(shop)
    page = admin_client.post(
        base + "pages/", {"title": "Home", "status": "published"}
    ).json()
    assert page["slug"] == "home"
    # Duplicate title auto-increments the slug.
    page2 = admin_client.post(base + "pages/", {"title": "Home"}).json()
    assert page2["slug"] == "home-2"

    s1 = admin_client.post(
        f"{base}pages/{page['id']}/sections/",
        {"type": "hero", "settings": {"heading": "Hello"}},
        content_type="application/json",
    ).json()
    s2 = admin_client.post(
        f"{base}pages/{page['id']}/sections/",
        {"type": "faq", "settings": {"items": [{"q": "Q?", "a": "A."}]}},
        content_type="application/json",
    ).json()
    assert (s1["position"], s2["position"]) == (0, 1)

    bad = admin_client.post(
        f"{base}pages/{page['id']}/sections/",
        {"type": "nope"},
        content_type="application/json",
    )
    assert bad.status_code == 400

    reorder = admin_client.post(
        f"{base}pages/{page['id']}/sections/reorder/",
        {"ids": [s2["id"], s1["id"]]},
        content_type="application/json",
    )
    assert [s["id"] for s in reorder.json()] == [s2["id"], s1["id"]]
    assert Section.objects.get(pk=s1["id"]).position == 1


def test_render_page_on_mapped_domain(client, shop):
    page = Page.objects.create(site=shop, title="Home", slug="home", status="published")
    page.sections.create(
        type="hero",
        position=0,
        settings={"heading": "Hello Shop", "subheading": "Best shop"},
    )
    resp = client.get("/", HTTP_HOST="shop.test")
    assert resp.status_code == 200
    assert "Hello Shop" in resp.content.decode()


def test_unknown_host_404(client, db):
    assert client.get("/", HTTP_HOST="nobody.test").status_code == 404


def test_post_and_product_flow(admin_client, shop):
    base = builder_base(shop)
    cat = admin_client.post(base + "post-categories/", {"name": "News"}).json()
    tag_id = admin_client.post(
        base + "tags/", {"name": "promo", "slug": "promo"}
    ).json()["id"]
    post = admin_client.post(
        base + "posts/",
        {
            "title": "Launch",
            "body": "<p>We launched</p>",
            "status": "published",
            "category": cat["id"],
            "tags": ["promo"],
        },
        content_type="application/json",
    ).json()
    assert tag_id and post["slug"] == "launch"

    menu = admin_client.post(base + "menus/", {"name": "Main", "slug": "main"}).json()
    item = admin_client.post(
        f"{base}menus/{menu['id']}/items/", {"label": "Blog", "url": "/blog/launch/"}
    ).json()
    assert item["position"] == 0

    pcat = admin_client.post(base + "product-categories/", {"name": "Gadgets"}).json()
    product = admin_client.post(
        base + "products/",
        {
            "name": "Widget",
            "price": "19.99",
            "stock": 5,
            "status": "published",
            "category": pcat["id"],
            "variants": [{"name": "Red", "price_delta": "2.00"}],
        },
        content_type="application/json",
    ).json()
    assert product["slug"] == "widget"

    anon = admin_client.__class__()
    assert (
        "We launched"
        in anon.get("/blog/launch/", HTTP_HOST="shop.test").content.decode()
    )
    shop_page = anon.get("/shop/widget/", HTTP_HOST="shop.test").content.decode()
    assert "Widget" in shop_page and "19.99" in shop_page

    bad_price = admin_client.post(base + "products/", {"name": "Bad", "price": "-1"})
    assert bad_price.status_code == 400


def test_themes_and_assign(admin_client, shop):
    themes = admin_client.get("/api/v1/builder/themes/").json()
    assert {t["slug"] for t in themes} >= {"starter", "commerce"}
    starter = next(t for t in themes if t["slug"] == "starter")
    assigned = admin_client.post(
        f"/api/v1/sites/{shop.pk}/builder/theme/", {"theme": starter["id"]}
    )
    assert assigned.json()["theme_name"] == "Starter"
    shop.refresh_from_db()
    assert shop.theme.slug == "starter"


def test_sitemap_and_robots(client, shop):
    Page.objects.create(site=shop, title="Home", slug="home", status="published")
    Product.objects.create(
        site=shop, name="Widget", slug="widget", price=9, status="published"
    )
    xml = client.get("/sitemap.xml", HTTP_HOST="shop.test")
    assert xml.status_code == 200
    assert "https://shop.test/shop/widget/" in xml.content.decode()
    robots = client.get("/robots.txt", HTTP_HOST="shop.test")
    assert "Sitemap: https://shop.test/sitemap.xml" in robots.content.decode()


def test_generate_sitemap_task(shop):
    from apps.builder.tasks import generate_sitemap

    Page.objects.create(site=shop, title="Home", slug="home", status="published")
    result = generate_sitemap.apply(args=[shop.pk]).get()
    assert result["status"] == "generated" and result["urls"] >= 1


def test_menu_items_reorder(admin_client, shop):
    base = builder_base(shop)
    menu = admin_client.post(base + "menus/", {"name": "Main"}).json()
    ids = [
        admin_client.post(
            f"{base}menus/{menu['id']}/items/", {"label": f"L{i}", "url": f"/{i}/"}
        ).json()["id"]
        for i in range(3)
    ]
    rev = list(reversed(ids))
    resp = admin_client.post(
        f"{base}menus/{menu['id']}/items/reorder/",
        {"ids": rev},
        content_type="application/json",
    )
    assert [i["id"] for i in resp.json()] == rev
    assert Menu.objects.get(pk=menu["id"]).items.first().label == "L2"
