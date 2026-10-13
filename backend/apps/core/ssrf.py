"""SSRF guard for every outbound fetch. Block non-public targets, including after redirects."""

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

import requests

ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443}
MAX_REDIRECTS = 5
MAX_BYTES = 2_000_000
REQUEST_TIMEOUT = 15


class UnsafeURLError(ValueError):
    """Raised when a URL (or any redirect hop) is not a safe public target."""


@dataclass(frozen=True)
class SafeURL:
    url: str
    hostname: str
    port: int
    ips: tuple


@dataclass
class FetchResult:
    url: str
    status_code: int
    text: str


def normalize_url(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        raise UnsafeURLError("Empty URL.")
    if "://" not in value:
        value = "https://" + value
    parts = urlsplit(value)
    if parts.scheme.lower() not in ALLOWED_SCHEMES:
        raise UnsafeURLError(
            f"Only http/https URLs are allowed, got: {parts.scheme or 'none'}."
        )
    if parts.username or parts.password:
        raise UnsafeURLError("URLs with credentials are not allowed.")
    if not parts.hostname:
        raise UnsafeURLError("URL has no hostname.")
    return value


def resolve_ips(hostname: str) -> tuple:
    try:
        infos = socket.getaddrinfo(
            hostname, None, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM
        )
    except OSError as exc:
        raise UnsafeURLError(f"Cannot resolve host {hostname!r}.") from exc
    ips = tuple(sorted({info[4][0] for info in infos}))
    if not ips:
        raise UnsafeURLError(f"Host {hostname!r} resolved to no addresses.")
    return ips


def check_ip_public(ip: str, hostname: str) -> None:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError as exc:
        raise UnsafeURLError(f"Unparseable address for {hostname!r}.") from exc
    if not addr.is_global:
        raise UnsafeURLError(f"Host {hostname!r} resolves to non-public address {ip}.")


def validate_public_url(raw: str) -> SafeURL:
    """Normalize + resolve + reject anything that is not a public http(s) target."""
    url = normalize_url(raw)
    parts = urlsplit(url)
    hostname = parts.hostname or ""
    port = parts.port or (443 if parts.scheme == "https" else 80)
    if port not in ALLOWED_PORTS:
        raise UnsafeURLError(
            f"Port {port} is not allowed; use the default http/https port."
        )
    ips = resolve_ips(hostname)
    for ip in ips:
        check_ip_public(ip, hostname)
    return SafeURL(url=url, hostname=hostname, port=port, ips=ips)


def safe_fetch(raw_url: str) -> FetchResult:
    """GET a public URL with manual redirect handling; every hop is re-validated."""
    current = validate_public_url(raw_url).url
    session = requests.Session()
    session.trust_env = False  # ignore proxy env vars: fetches must go direct
    try:
        for _ in range(MAX_REDIRECTS + 1):
            resp = session.get(
                current,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=False,
                stream=True,
                headers={"User-Agent": "CMS-Platform/1.0 (+discovery)"},
            )
            if resp.status_code in (301, 302, 303, 307, 308):
                location = resp.headers.get("Location", "")
                resp.close()
                if not location:
                    raise UnsafeURLError("Redirect without Location header.")
                # Re-validate the next hop from scratch (DNS + IP + port + scheme).
                current = validate_public_url(urljoin(current, location)).url
                continue
            chunks: list[bytes] = []
            size = 0
            for chunk in resp.iter_content(chunk_size=65536):
                if not chunk:
                    continue
                size += len(chunk)
                if size > MAX_BYTES:
                    resp.close()
                    raise UnsafeURLError("Response exceeds the 2 MB discovery limit.")
                chunks.append(chunk)
            body = b"".join(chunks)
            encoding = resp.encoding or "utf-8"
            try:
                text = body.decode(encoding, errors="replace")
            except LookupError:
                text = body.decode("utf-8", errors="replace")
            resp.close()
            return FetchResult(url=current, status_code=resp.status_code, text=text)
        raise UnsafeURLError(f"Too many redirects (>{MAX_REDIRECTS}).")
    finally:
        session.close()
