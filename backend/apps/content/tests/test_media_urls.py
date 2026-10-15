"""Media links retain the browser origin for previews and external site embeds."""

import pytest
from django.test import RequestFactory, override_settings

from apps.content.models import MediaAsset
from apps.content.serializers import MediaAssetSerializer


@pytest.mark.parametrize(
    ("host", "secure"),
    [("localhost:8080", False), ("127.0.0.1:8080", False), ("cms.example.com", True)],
)
@override_settings(ALLOWED_HOSTS=["localhost", "127.0.0.1", "cms.example.com"])
def test_media_url_preserves_request_origin(host, secure):
    asset = MediaAsset(file="media/2026/10/example.png")
    request = RequestFactory().get("/api/v1/media/", HTTP_HOST=host, secure=secure)
    data = MediaAssetSerializer(asset, context={"request": request}).data
    expected = f"{'https' if secure else 'http'}://{host}/media/media/2026/10/example.png"
    assert data["url"] == expected
    assert data["file"] == expected
