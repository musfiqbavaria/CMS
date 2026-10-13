"""Phase 5 tests: config draft/publish/rollback, versions, media validation."""

import io

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.audit.models import AuditLog
from apps.content.models import ConfigVersion
from apps.content.services import default_config
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
    return Site.objects.create(name="Ed", domain="ed.example.com")


def png_file(name="pic.png", size=(40, 30)):
    buf = io.BytesIO()
    Image.new("RGB", size, "red").save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def test_config_seeded_from_discovery(admin_client, site):
    site.discovery = {"title": "Shop", "logo_url": "https://x/logo.png"}
    site.save()
    resp = admin_client.get(f"/api/v1/sites/{site.pk}/config/")
    assert resp.status_code == 200
    draft = resp.json()["draft"]
    assert draft["hero"]["heading"] == "Shop"
    assert draft["branding"]["logo_url"] == "https://x/logo.png"


def test_draft_publish_rollback_flow(admin_client, site):
    base = f"/api/v1/sites/{site.pk}/config/"
    # Autosave patch: silent, no version.
    r = admin_client.patch(
        base, {"hero": {"heading": "Hello"}}, content_type="application/json"
    )
    assert r.status_code == 200
    assert r.json()["draft"]["hero"]["heading"] == "Hello"
    assert ConfigVersion.objects.count() == 0

    # Save draft -> version 1.
    v1 = admin_client.post(base + "save-draft/", {"note": "first"}).json()
    assert v1["version_no"] == 1 and v1["status"] == "draft"

    # Publish -> live.
    pub = admin_client.post(base + "publish/", {}).json()
    assert pub["status"] == "published"
    assert admin_client.get(base).json()["published"]["hero"]["heading"] == "Hello"

    # Change + save + publish v2.
    admin_client.patch(
        base, {"hero": {"heading": "World"}}, content_type="application/json"
    )
    admin_client.post(base + "save-draft/", {})
    admin_client.post(base + "publish/", {})
    assert admin_client.get(base).json()["published"]["hero"]["heading"] == "World"

    # Rollback to v1 -> published copy of v1, audited as rolled_back.
    rb = admin_client.post(base + f"versions/{v1['id']}/rollback/").json()
    assert rb["status"] == "published"
    assert admin_client.get(base).json()["published"]["hero"]["heading"] == "Hello"
    assert (
        AuditLog.objects.filter(action="rolled_back", model="siteconfig").count() == 1
    )
    assert AuditLog.objects.filter(action="published", model="siteconfig").count() == 2


def test_versions_list(admin_client, site):
    base = f"/api/v1/sites/{site.pk}/config/"
    admin_client.post(base + "save-draft/", {})
    resp = admin_client.get(base + "versions/")
    assert resp.json()["count"] == 1


def test_media_upload_and_validation(admin_client, site):
    resp = admin_client.post(
        "/api/v1/media/",
        {"site": site.pk, "alt": "pic", "file": png_file()},
        format="multipart",
    )
    assert resp.status_code == 201, resp.json()
    data = resp.json()
    assert data["width"] == 40 and data["url"].endswith(".png")

    bad = admin_client.post(
        "/api/v1/media/",
        {"file": SimpleUploadedFile("x.svg", b"<svg/>", content_type="image/svg+xml")},
        format="multipart",
    )
    assert bad.status_code == 400

    fake = admin_client.post(
        "/api/v1/media/",
        {
            "file": SimpleUploadedFile(
                "x.png", b"not-an-image", content_type="image/png"
            )
        },
        format="multipart",
    )
    assert fake.status_code == 400

    lib = admin_client.get(f"/api/v1/media/?site={site.pk}")
    assert lib.json()["count"] == 1


def test_editor_endpoints_require_auth(client, site):
    assert client.get(f"/api/v1/sites/{site.pk}/config/").status_code == 401
    assert client.post("/api/v1/media/", {}).status_code == 401


def test_default_config_shape():
    cfg = default_config(Site(name="N", domain="n.example.com"))
    for section in [
        "general",
        "header",
        "footer",
        "branding",
        "cover",
        "hero",
        "navigation",
        "theme",
        "seo",
        "custom",
        "social",
    ]:
        assert section in cfg
