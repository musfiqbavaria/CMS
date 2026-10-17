"""Connector delivery: cached published config, loader.js, proxy injection."""

import hashlib
import ipaddress
import json
import logging
from urllib.parse import urlsplit, urlunsplit

from django.conf import settings
from django.core.cache import cache

from apps.sites.models import Site

from .models import DEFAULT_SELECTORS, SelectorMapping

CACHE_TTL = 3600
logger = logging.getLogger(__name__)


def cache_key(site_key: str) -> str:
    return f"connector:config:v3:{site_key}"


def public_site(site_key: str):
    """Published config is served only for active sites. Returns None otherwise."""
    try:
        site = (
            Site.objects.select_related("config", "config__published_version")
            .prefetch_related("mappings")
            .get(site_key=site_key)
        )
    except Site.DoesNotExist:
        return None
    if site.status != Site.Statuses.ACTIVE:
        return None
    return site


def ensure_default_mappings(site) -> None:
    existing = set(site.mappings.values_list("key", flat=True))
    # Defaults are seeded once. Re-adding every missing key would silently
    # undo intentional mapping deletions on the next public page load.
    if existing:
        return
    missing = [
        SelectorMapping(site=site, key=key, selector=sel)
        for key, sel in DEFAULT_SELECTORS.items()
        if key not in existing
    ]
    if missing:
        SelectorMapping.objects.bulk_create(missing, ignore_conflicts=True)
        getattr(site, "_prefetched_objects_cache", {}).pop("mappings", None)


def delivery_media_url(value) -> str:
    """Local uploads resolve against the loader's CMS origin, not a visitor's PC."""
    if not isinstance(value, str) or not value:
        return ""
    try:
        parsed = urlsplit(value)
        host = parsed.hostname or ""
        cms_host = urlsplit(getattr(settings, "CMS_PUBLIC_URL", "")).hostname
        local = host in {"localhost", "backend", "nginx", "daphne", cms_host}
        try:
            local = local or ipaddress.ip_address(host).is_loopback
        except ValueError:
            pass
        if local and parsed.path.startswith(settings.MEDIA_URL):
            return urlunsplit(("", "", parsed.path, parsed.query, parsed.fragment))
    except ValueError:
        pass
    return value


def build_payload(site) -> dict:
    """Flatten the published snapshot into loader-ready data + enabled mappings."""
    ensure_default_mappings(site)
    from apps.content.services import changed_paths, default_config

    pub = site.config.published if hasattr(site, "config") else {}
    pub = pub or {}
    header = pub.get("header", {})
    hero = pub.get("hero", {})
    footer = pub.get("footer", {})
    branding = pub.get("branding", {})
    theme = pub.get("theme", {})
    custom = pub.get("custom", {})
    general = pub.get("general", {})
    edits = set(pub.get("_overrides") or [])
    seo = dict(pub.get("seo") or {})
    defaults = default_config(site)
    if seo.get("title") == defaults["seo"]["title"] and "seo.title" not in edits:
        seo["title"] = general.get("site_name") or seo.get("title")
    seo["og_image"] = delivery_media_url(seo.get("og_image", ""))
    edits.update(changed_paths(defaults, pub))
    verified = site.verification_status == Site.VerificationStatuses.VERIFIED
    data = {
        "site_name": general.get("site_name", site.name),
        "tagline": general.get("tagline", ""),
        "logo_url": delivery_media_url(
            branding.get("logo_url") or header.get("logo_url", "")
        ),
        "favicon_url": delivery_media_url(branding.get("favicon_url", "")),
        "header_cta_text": header.get("cta_text", ""),
        "header_cta_url": header.get("cta_url", ""),
        "header": {
            "layout": header.get("layout", "left"),
            "sticky": header.get("sticky", False),
        },
        "navigation": pub.get("navigation") or {},
        "hero": {
            "eyebrow": hero.get("eyebrow", ""),
            "heading": hero.get("heading", ""),
            "subheading": hero.get("subheading", ""),
            "background_image": delivery_media_url(hero.get("background_image", "")),
            "alignment": hero.get("alignment", "center"),
            "overlay_opacity": hero.get("overlay_opacity", 0.5),
            "buttons": hero.get("buttons", []),
        },
        "footer_copyright": footer.get("copyright", ""),
        "footer": footer,
        "social": pub.get("social") or {},
        "seo": seo,
        "cover_image": delivery_media_url(
            (pub.get("cover") or {}).get("image_url", "")
        ),
        "cover_overlay_opacity": (pub.get("cover") or {}).get("overlay_opacity", 0.4),
        "colors": (theme.get("colors", {}) or {}),
        "typography": theme.get("typography") or {},
        "overrides": sorted(edits),
        # Admin-authored code is served only to the verified owner's site.
        "custom_css": custom.get("css", "") if verified else "",
        "custom_js": custom.get("js", "") if verified else "",
    }
    mappings = [
        {"key": m.key, "selector": m.selector}
        for m in sorted(site.mappings.all(), key=lambda item: item.key)
        if m.enabled
    ]
    payload = {
        "site_key": site.site_key,
        "domain": site.domain,
        "verified": verified,
        "schema_version": 3,
        "published_version": (
            site.config.published_version.version_no
            if hasattr(site, "config") and site.config.published_version_id
            else None
        ),
        "data": data,
        "mappings": mappings,
    }
    payload["delivery_revision"] = etag_for(payload).strip('"')
    return payload


def etag_for(payload: dict) -> str:
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    return f'"{digest}"'


def get_cached_payload(site) -> tuple:
    """Returns (payload, etag), building + caching on miss."""
    key = cache_key(site.site_key)
    # Validate cached content against DB revisions as well as purging. This
    # closes races with concurrent requests and survives a missed cache purge.
    ensure_default_mappings(site)
    revision = etag_for(
        {
            "schema": 3,
            "verified": site.verification_status,
            "published": (
                site.config.published_version_id if hasattr(site, "config") else None
            ),
            "mappings": sorted(
                (m.key, m.selector, m.enabled) for m in site.mappings.all()
            ),
        }
    )
    try:
        cached = cache.get(key)
    except Exception:
        logger.warning(
            "Connector cache read failed; serving published data", exc_info=True
        )
        cached = None
    if cached and cached.get("revision") == revision:
        return cached["payload"], cached["etag"]
    payload = build_payload(site)
    etag = etag_for(payload)
    try:
        cache.set(
            key, {"payload": payload, "etag": etag, "revision": revision}, CACHE_TTL
        )
    except Exception:
        logger.warning("Connector cache write failed", exc_info=True)
    return payload, etag


def purge_site_cache(site) -> None:
    try:
        cache.delete(cache_key(site.site_key))
    except Exception:
        # A committed publish must not turn into a misleading HTTP 500 when
        # Redis is unavailable. The revision check above prevents stale reads.
        logger.warning("Connector cache purge failed", exc_info=True)
