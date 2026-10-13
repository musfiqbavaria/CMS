"""Site editor business logic: drafts, versions, publish/rollback, media."""

import copy

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.db.models import Max
from PIL import Image

from apps.audit.models import AuditLog
from apps.audit.services import client_ip, log_action

from .models import ConfigVersion, SiteConfig

ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}


def default_config(site) -> dict:
    """Seed a new draft from the discovery snapshot (logo/favicon/title)."""
    snap = getattr(site, "discovery", {}) or {}
    title = snap.get("title") or site.name
    return {
        "general": {"site_name": title, "tagline": snap.get("description", "")},
        "header": {
            "logo_url": snap.get("logo_url", ""),
            "layout": "left",
            "sticky": True,
            "cta_text": "",
            "cta_url": "",
        },
        "footer": {
            "columns": [{"heading": "Links", "links": [{"label": "Home", "url": "/"}]}],
            "copyright": f"© {site.name}",
            "show_newsletter": False,
        },
        "branding": {
            "logo_url": snap.get("logo_url", ""),
            "favicon_url": snap.get("favicon_url", ""),
        },
        "cover": {"image_url": "", "overlay_opacity": 0.4},
        "hero": {
            "eyebrow": "",
            "heading": title,
            "subheading": snap.get("description", ""),
            "background_image": "",
            "alignment": "center",
            "overlay_opacity": 0.5,
            "buttons": [{"label": "Get started", "url": "#", "variant": "primary"}],
        },
        "navigation": {"items": [{"label": "Home", "url": "/"}]},
        "theme": {
            "colors": {
                "primary": snap.get("theme_color", "#0f172a"),
                "secondary": "#334155",
                "background": "#ffffff",
                "text": "#0f172a",
            },
            "typography": {
                "heading_font": "system-ui",
                "body_font": "system-ui",
                "base_size": 16,
            },
        },
        "seo": {
            "title": title,
            "description": snap.get("description", ""),
            "keywords": "",
            "og_image": snap.get("logo_url", ""),
        },
        "custom": {"css": "", "js": ""},
        "social": {
            "facebook": "",
            "x": "",
            "instagram": "",
            "linkedin": "",
            "youtube": "",
        },
    }


def get_or_create_config(site) -> SiteConfig:
    config, created = SiteConfig.objects.get_or_create(
        site=site, defaults={"draft": default_config(site)}
    )
    if created:
        return config
    if not config.draft:
        config.draft = default_config(site)
        config.save(update_fields=["draft"])
    return config


def deep_merge(base: dict, patch: dict) -> dict:
    """Recursive dict merge; lists and scalars are replaced, never merged."""
    merged = copy.deepcopy(base)
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = copy.deepcopy(value)
    return merged


@transaction.atomic
def update_draft(*, actor, site, patch: dict) -> SiteConfig:
    """Silent autosave: merges into the draft without versions or audit rows."""
    config = get_or_create_config(site)
    config.draft = deep_merge(config.draft or {}, patch or {})
    config.updated_by = actor
    config.save(update_fields=["draft", "updated_by", "updated_at"])
    return config


def _next_version_no(site) -> int:
    return (site.versions.aggregate(m=Max("version_no"))["m"] or 0) + 1


@transaction.atomic
def save_draft(*, actor, site, note="", request=None) -> ConfigVersion:
    config = get_or_create_config(site)
    version = ConfigVersion.objects.create(
        site=site,
        version_no=_next_version_no(site),
        snapshot=copy.deepcopy(config.draft),
        status=ConfigVersion.Statuses.DRAFT,
        author=actor,
        note=note[:255],
    )
    log_action(
        actor=actor,
        action=AuditLog.Actions.UPDATED,
        site=site,
        before={"draft_saved": False},
        after={"draft_saved": True, "version_no": version.version_no},
        ip_address=client_ip(request),
        model="siteconfig",
    )
    return version


@transaction.atomic
def publish(
    *, actor, site, version_id=None, action="published", request=None
) -> ConfigVersion:
    """Publish a version (latest draft by default). Archives the previous live one."""
    config = get_or_create_config(site)
    if version_id is not None:
        target = site.versions.get(pk=version_id)
    else:
        target = (
            site.versions.filter(status=ConfigVersion.Statuses.DRAFT)
            .order_by("-version_no")
            .first()
        )
        if target is None:
            target = ConfigVersion.objects.create(
                site=site,
                version_no=_next_version_no(site),
                snapshot=copy.deepcopy(config.draft),
                status=ConfigVersion.Statuses.DRAFT,
                author=actor,
            )
    site.versions.filter(status=ConfigVersion.Statuses.PUBLISHED).exclude(
        pk=target.pk
    ).update(status=ConfigVersion.Statuses.ARCHIVED)
    target.status = ConfigVersion.Statuses.PUBLISHED
    target.save(update_fields=["status"])
    config.published = copy.deepcopy(target.snapshot)
    config.published_version = target
    config.updated_by = actor
    config.save(
        update_fields=["published", "published_version", "updated_by", "updated_at"]
    )
    # Invalidate the public connector cache (purge runs after commit).
    from apps.connector.tasks import purge_connector_cache

    transaction.on_commit(lambda: purge_connector_cache.delay(site.pk))
    log_action(
        actor=actor,
        action=(
            AuditLog.Actions.PUBLISHED
            if action == "published"
            else AuditLog.Actions.ROLLED_BACK
        ),
        site=site,
        before={},
        after={"version_no": target.version_no},
        ip_address=client_ip(request),
        model="siteconfig",
    )
    return target


def rollback(*, actor, site, version_id, request=None) -> ConfigVersion:
    return publish(
        actor=actor,
        site=site,
        version_id=version_id,
        action="rolled_back",
        request=request,
    )


def reset_draft_to_published(*, actor, site) -> SiteConfig:
    """Discard unsaved draft edits by restoring the published snapshot."""
    config = get_or_create_config(site)
    config.draft = copy.deepcopy(config.published) or default_config(site)
    config.updated_by = actor
    config.save(update_fields=["draft", "updated_by", "updated_at"])
    return config


def validate_image_upload(upload: UploadedFile) -> dict:
    """Extension + size + real-image verification. Returns inspected metadata."""
    ext = (upload.name.rsplit(".", 1)[-1] if "." in upload.name else "").lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError(
            f"Images only ({', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}). No SVG."
        )
    max_bytes = int(getattr(settings, "MEDIA_MAX_BYTES", 10 * 1024 * 1024))
    if upload.size and upload.size > max_bytes:
        raise ValidationError(f"File too large (>{max_bytes // (1024 * 1024)} MB).")
    try:
        with Image.open(upload) as img:
            img.verify()
    except Exception as exc:
        raise ValidationError("File is not a valid image.") from exc
    try:
        with Image.open(upload) as img:
            width, height = img.size
    except Exception as exc:
        raise ValidationError("Could not read image dimensions.") from exc
    if upload.size and (width <= 0 or height <= 0):
        raise ValidationError("Invalid image dimensions.")
    return {"width": width, "height": height, "size": upload.size or 0}
