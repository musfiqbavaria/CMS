"""Read-only, opaque-origin inspection of a verified site's public layout."""

import json
import secrets

from django.utils.html import format_html

from apps.content.services import sanitize_page_blocks

from .models import DEFAULT_SELECTORS


def inspector_tag(request, site, channel, nonce):
    mappings = list(site.mappings.all())
    mapping_targets = (
        [
            {
                "key": mapping.key,
                "label": mapping.get_key_display(),
                "selector": mapping.selector,
            }
            for mapping in mappings
            if mapping.enabled
        ]
        if mappings
        else [
            {"key": key, "label": key.label, "selector": selector}
            for key, selector in DEFAULT_SELECTORS.items()
        ]
    )
    config_row = getattr(site, "config", None)
    draft = (config_row.draft if config_row else None) or {}
    # Page text blocks come first: they are page-scoped and override the
    # site-wide mappings on the pages where both target the same element.
    block_targets = [
        {
            "key": block["id"],
            "label": block["label"] or "Page text",
            "selector": block["selector"],
            "path": block["path"],
        }
        for block in sanitize_page_blocks((draft.get("pages") or {}).get("blocks"))
    ]
    config = {
        "channel": channel,
        "parentOrigin": request.build_absolute_uri("/").rstrip("/"),
        "targets": block_targets + mapping_targets,
    }
    return format_html(
        '<script nonce="{}" src="{}" data-cms-editor-config="{}"></script>',
        nonce,
        request.build_absolute_uri("/connector/v1/editor-bridge.js"),
        json.dumps(config),
    )


def loader_tag(request, site, nonce):
    """Run the published connector in the preview so it matches the live site.

    Without this, the preview would always show the website's pre-CMS state:
    the site's own loader tag carries no preview nonce and is refused by the
    preview CSP. Preview mode skips delivery reports and custom JavaScript.
    """
    return format_html(
        '<script nonce="{}" src="{}" data-cms-preview="1"></script>',
        nonce,
        request.build_absolute_uri(f"/connector/v1/loader.js?site={site.site_key}"),
    )


def preview_policy(request, site, nonce):
    origin = request.build_absolute_uri("/").rstrip("/")
    return "; ".join(
        [
            "default-src 'none'",
            f"script-src 'nonce-{nonce}'",
            f"style-src 'unsafe-inline' https: {origin}",
            f"img-src https: data: blob: {origin}",
            f"font-src https: data: {origin}",
            f"media-src https: blob: {origin}",
            f"base-uri https://{site.domain}",
            # The preview-mode loader fetches the published configuration from
            # this CMS; every other origin stays unreachable and forms/frames
            # remain blocked.
            f"connect-src {origin}",
            "frame-src 'none'",
            "object-src 'none'",
            "form-action 'none'",
            "frame-ancestors 'self'",
            # allow-popups lets the bridge open original pages in real tabs
            # (Ctrl/⌘+click, target=_blank) without leaving the sandbox.
            "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
        ]
    )


def preview_nonce():
    return secrets.token_urlsafe(24)
