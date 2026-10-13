"""Domain discovery + ownership verification. Services coordinate; tasks run async."""

from urllib.parse import urljoin

import dns.resolver
from asgiref.sync import async_to_sync
from bs4 import BeautifulSoup
from channels.layers import get_channel_layer
from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import client_ip, log_action
from apps.core.ssrf import UnsafeURLError, safe_fetch, validate_public_url

from .models import Site

VERIFY_META_NAME = "cms-verify"


class DiscoveryError(Exception):
    """Expected failure (bad target, parse problem). Not retried."""


def progress_event(site_id: int, stage: str, **extra) -> None:
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"site_{site_id}",
        {"type": "site.progress", "stage": stage, "site_id": site_id, **extra},
    )


def group_name(site_id: int) -> str:
    return f"site_{site_id}"


def discover_domain(domain: str) -> dict:
    """SSRF-safe fetch + parse of a site's homepage. Pure function (no DB)."""
    try:
        safe = validate_public_url(f"https://{domain}")
    except UnsafeURLError as exc:
        raise DiscoveryError(str(exc)) from exc
    try:
        result = safe_fetch(safe.url)
    except UnsafeURLError as exc:
        raise DiscoveryError(str(exc)) from exc
    except Exception as exc:
        raise DiscoveryError(f"Fetch failed: {exc}") from exc
    return parse_homepage(result.url, result.status_code, result.text)


def parse_homepage(final_url: str, status_code: int, html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    description = ""
    theme_color = ""
    for meta in soup.find_all("meta"):
        name = (meta.get("name", "") or "").lower()
        prop = (meta.get("property", "") or "").lower()
        if name == "description" and not description:
            description = (meta.get("content", "") or "").strip()
        if name == "theme-color" and not theme_color:
            theme_color = (meta.get("content", "") or "").strip()
        if prop == "og:description" and not description:
            description = (meta.get("content", "") or "").strip()
    favicon_url = ""
    icon_link = soup.find("link", rel=lambda v: v and "icon" in v.lower())
    if icon_link and icon_link.get("href"):
        favicon_url = urljoin(final_url, icon_link["href"])
    logo_url = ""
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        logo_url = urljoin(final_url, og_image["content"])
    if not logo_url:
        for img in soup.find_all("img"):
            haystack = " ".join(
                [
                    img.get("src", ""),
                    img.get("alt", ""),
                    " ".join(img.get("class", [])),
                    img.get("id", ""),
                ]
            ).lower()
            if "logo" in haystack and img.get("src"):
                logo_url = urljoin(final_url, img["src"])
                break
    return {
        "title": title[:255],
        "description": description[:500],
        "theme_color": theme_color[:32],
        "favicon_url": favicon_url[:500],
        "logo_url": logo_url[:500],
        "final_url": final_url[:500],
        "status_code": status_code,
        "fetched_at": timezone.now().isoformat(),
    }


@transaction.atomic
def mark_discovery(site: Site, *, status: str, snapshot=None, error="") -> Site:
    site.discovery_status = status
    if snapshot is not None:
        site.discovery = snapshot
        site.discovered_at = timezone.now()
    if error:
        site.discovery_error = error[:2000]
    else:
        site.discovery_error = ""
    site.save(
        update_fields=[
            "discovery_status",
            "discovery",
            "discovered_at",
            "discovery_error",
            "updated_at",
        ]
    )
    return site


def check_meta_tag(domain: str, token: str) -> tuple:
    """Fetch the homepage and compare the cms-verify meta tag. Returns (ok, detail)."""
    try:
        result = safe_fetch(f"https://{domain}")
    except UnsafeURLError as exc:
        return False, str(exc)
    except Exception as exc:
        return False, f"Fetch failed: {exc}"
    soup = BeautifulSoup(result.text, "lxml")
    tag = soup.find("meta", attrs={"name": VERIFY_META_NAME})
    if tag is None:
        return (
            False,
            f'No <meta name="{VERIFY_META_NAME}"> found (HTTP {result.status_code}).',
        )
    content = (tag.get("content", "") or "").strip()
    if content == token:
        return True, "Meta tag matches."
    return False, "Meta tag present but the token does not match."


def check_dns_txt(domain: str, token: str) -> tuple:
    """Look for a `cms-verify=TOKEN` TXT record on the apex domain."""
    expected = f"cms-verify={token}"
    try:
        answers = dns.resolver.resolve(domain, "TXT", lifetime=10)
    except Exception as exc:
        return False, f"DNS query failed: {exc}"
    found = []
    for rdata in answers:
        for part in getattr(rdata, "strings", [str(rdata)]):
            text = (
                part.decode(errors="replace") if isinstance(part, bytes) else str(part)
            )
            found.append(text.strip().strip('"'))
    if expected in found:
        return True, "DNS TXT record matches."
    return False, f"No TXT record {expected!r} found (saw {len(found)} record(s))."


@transaction.atomic
def record_verification(
    site: Site, *, method: str, ok: bool, detail: str, actor=None, request=None
) -> Site:
    site.verification_method = method
    if ok:
        site.verification_status = Site.VerificationStatuses.VERIFIED
        site.verification_error = ""
        site.verified_at = timezone.now()
    else:
        site.verification_status = Site.VerificationStatuses.PENDING
        site.verification_error = detail[:2000]
    site.save(
        update_fields=[
            "verification_method",
            "verification_status",
            "verification_error",
            "verified_at",
            "updated_at",
        ]
    )
    if ok:
        log_action(
            actor=actor,
            action=AuditLog.Actions.VERIFIED,
            site=site,
            before={"verification_status": "pending"},
            after={"verification_status": "verified", "method": method},
            ip_address=client_ip(request),
        )
    return site
