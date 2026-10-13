"""SSRF guard tests: private targets rejected, redirects re-checked."""

from unittest.mock import patch

import pytest

from apps.core.ssrf import UnsafeURLError, safe_fetch, validate_public_url


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "ftp://example.com/",
        "http://127.0.0.1/",
        "http://localhost/",
        "http://10.0.0.5/",
        "http://172.16.9.9/",
        "http://192.168.1.20/",
        "http://169.254.169.254/",
        "http://0.0.0.0/",
        "http://[::1]/",
        "http://user:pass@example.com/",
        "http://example.com:8080/",
    ],
)
def test_unsafe_urls_rejected(raw):
    with pytest.raises(UnsafeURLError):
        validate_public_url(raw)


def test_public_url_ok_with_mocked_dns():
    with patch(
        "socket.getaddrinfo", return_value=[(2, 1, 6, "", ("93.184.216.34", 0))]
    ):
        safe = validate_public_url("example.com")
    assert safe.url == "https://example.com"
    assert safe.hostname == "example.com"
    assert safe.ips == ("93.184.216.34",)


class FakeResponse:
    def __init__(self, status_code=200, headers=None, body=b"", encoding="utf-8"):
        self.status_code = status_code
        self.headers = headers or {}
        self._body = body
        self.encoding = encoding
        self.closed = False

    def iter_content(self, chunk_size=65536):
        yield self._body

    def close(self):
        self.closed = True


class FakeSession:
    """First hop redirects to a private IP; safe_fetch must refuse to follow."""

    def __init__(self):
        self.trust_env = True

    def get(self, url, **kwargs):
        if "redirect" in url:
            return FakeResponse(302, {"Location": "http://127.0.0.1/admin"})
        return FakeResponse(200, {}, b"<html></html>")

    def close(self):
        pass


def fake_getaddrinfo(host, *args, **kwargs):
    if host == "127.0.0.1":
        return [(2, 1, 6, "", ("127.0.0.1", 0))]
    return [(2, 1, 6, "", ("93.184.216.34", 0))]


def test_redirect_to_private_ip_refused():
    with (
        patch("socket.getaddrinfo", side_effect=fake_getaddrinfo),
        patch("apps.core.ssrf.requests.Session", return_value=FakeSession()),
    ):
        with pytest.raises(UnsafeURLError):
            safe_fetch("https://example.com/redirect")
