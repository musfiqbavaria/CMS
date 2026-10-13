"""Connector delivery: cached published config, loader.js, proxy injection."""

import hashlib
import json

from django.core.cache import cache

from apps.sites.models import Site

from .models import DEFAULT_SELECTORS, SelectorMapping

CACHE_TTL = 3600


def cache_key(site_key: str) -> str:
    return f"connector:config:{site_key}"


def public_site(site_key: str):
    """Published config is served only for active sites. Returns None otherwise."""
    try:
        site = Site.objects.prefetch_related("mappings").get(site_key=site_key)
    except Site.DoesNotExist:
        return None
    if site.status != Site.Statuses.ACTIVE:
        return None
    return site


def ensure_default_mappings(site) -> None:
    existing = set(site.mappings.values_list("key", flat=True))
    missing = [
        SelectorMapping(site=site, key=key, selector=sel)
        for key, sel in DEFAULT_SELECTORS.items()
        if key not in existing
    ]
    if missing:
        SelectorMapping.objects.bulk_create(missing)


def build_payload(site) -> dict:
    """Flatten the published snapshot into loader-ready data + enabled mappings."""
    ensure_default_mappings(site)
    pub = site.config.published if hasattr(site, "config") else {}
    pub = pub or {}
    header = pub.get("header", {})
    hero = pub.get("hero", {})
    footer = pub.get("footer", {})
    branding = pub.get("branding", {})
    theme = pub.get("theme", {})
    custom = pub.get("custom", {})
    general = pub.get("general", {})
    verified = site.verification_status == Site.VerificationStatuses.VERIFIED
    data = {
        "site_name": general.get("site_name", site.name),
        "logo_url": branding.get("logo_url") or header.get("logo_url", ""),
        "favicon_url": branding.get("favicon_url", ""),
        "header_cta_text": header.get("cta_text", ""),
        "header_cta_url": header.get("cta_url", ""),
        "hero": {
            "eyebrow": hero.get("eyebrow", ""),
            "heading": hero.get("heading", ""),
            "subheading": hero.get("subheading", ""),
            "background_image": hero.get("background_image", ""),
            "buttons": hero.get("buttons", []),
        },
        "footer_copyright": footer.get("copyright", ""),
        "cover_image": (pub.get("cover", {}) or {}).get("image_url", ""),
        "colors": (theme.get("colors", {}) or {}),
        # Admin-authored code is served only to the verified owner's site.
        "custom_css": custom.get("css", "") if verified else "",
        "custom_js": custom.get("js", "") if verified else "",
    }
    mappings = [
        {"key": m.key, "selector": m.selector}
        for m in site.mappings.filter(enabled=True).order_by("key")
    ]
    return {
        "site_key": site.site_key,
        "domain": site.domain,
        "verified": verified,
        "data": data,
        "mappings": mappings,
    }


def etag_for(payload: dict) -> str:
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    return f'"{digest}"'


def get_cached_payload(site) -> tuple:
    """Returns (payload, etag), building + caching on miss."""
    key = cache_key(site.site_key)
    cached = cache.get(key)
    if cached:
        return cached["payload"], cached["etag"]
    payload = build_payload(site)
    etag = etag_for(payload)
    cache.set(key, {"payload": payload, "etag": etag}, CACHE_TTL)
    return payload, etag


def purge_site_cache(site) -> None:
    cache.delete(cache_key(site.site_key))
