"""Signed, origin-scoped browser reports and administrator delivery summaries."""

import math
import time
import uuid
from datetime import datetime, timedelta
from datetime import timezone as datetime_timezone
from urllib.parse import unquote, urlsplit

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, Throttled

from apps.content.models import ConfigVersion
from apps.sites.models import Site

from .models import DeliveryReport, SelectorMapping
from .services import get_cached_payload

TICKET_SALT = "connector.delivery.v1"
TICKET_MAX_AGE = 600
REPORT_LIMIT = 60
HISTORY_LIMIT = 200
FRESH_SECONDS = 900
FIELD_LABELS = dict(SelectorMapping.Keys.choices)
FIELD_LABELS.update(
    {
        "metadata": "Browser title and metadata",
        "theme_fonts": "Typography",
        "custom_css": "Custom CSS",
        "custom_js": "Custom JavaScript",
        "configuration": "Configuration request",
    }
)


def issue_ticket(site):
    return signing.dumps(
        {"site": site.pk, "attempt": uuid.uuid4().hex, "issued_at": time.time()},
        salt=TICKET_SALT,
    )


def origin_parts(value):
    try:
        parsed = urlsplit(value)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.path not in {"", "/"}
            or parsed.query
            or parsed.fragment
        ):
            return None
        return (
            parsed.scheme,
            parsed.hostname.lower(),
            parsed.port or (443 if parsed.scheme == "https" else 80),
        )
    except ValueError:
        return None


def report_context(request, site, page_path):
    origin = origin_parts(request.headers.get("Origin", ""))
    if not origin:
        raise PermissionDenied("A website Origin is required.")
    cms = getattr(settings, "CMS_PUBLIC_URL", "") or request.build_absolute_uri(
        "/"
    ).rstrip("/")
    if origin == origin_parts(cms) and page_path.startswith("/connector/"):
        return "preview"
    hosts = {site.domain.lower()}
    hosts.update(
        site.domains.filter(verification_status="verified").values_list(
            "hostname", flat=True
        )
    )
    if origin[1] in hosts and origin[2] in {80, 443}:
        return "live"
    if origin == origin_parts(cms):
        return "preview"
    raise PermissionDenied("The report origin does not belong to this website.")


def private_path(value):
    """Never collect query strings, fragments, or long bearer-like path segments."""
    try:
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc:
            return "/"
        path = unquote(parsed.path)
    except ValueError:
        return "/"
    if not path.startswith("/") or path.startswith("//"):
        return "/"
    parts = [":id" if len(segment) >= 32 else segment for segment in path.split("/")]
    return "".join(
        char for char in "/".join(parts) if ord(char) >= 32 and ord(char) != 127
    )[:256]


class MissingFieldSerializer(serializers.Serializer):
    key = serializers.ChoiceField(choices=list(FIELD_LABELS))
    selector = serializers.CharField(max_length=255, allow_blank=True)


class FieldErrorSerializer(serializers.Serializer):
    key = serializers.ChoiceField(choices=list(FIELD_LABELS))
    message = serializers.CharField(max_length=300, allow_blank=True)


class ReportSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=2048)
    version = serializers.IntegerField(min_value=1, allow_null=True)
    revision = serializers.RegexField(r"^[a-f0-9]{64}$", allow_blank=True)
    state = serializers.ChoiceField(choices=["ready", "partial", "error"])
    page_path = serializers.CharField(max_length=1024, default="/")
    applied = serializers.ListField(
        child=serializers.ChoiceField(choices=list(FIELD_LABELS)), max_length=40
    )
    unmatched = serializers.ListField(child=MissingFieldSerializer(), max_length=40)
    errors = serializers.ListField(child=FieldErrorSerializer(), max_length=40)

    def validate(self, data):
        if data["state"] != "error" and (
            data["version"] is None or not data["revision"]
        ):
            raise serializers.ValidationError(
                "Applied reports need a version and revision."
            )
        if data["state"] == "ready" and (data["unmatched"] or data["errors"]):
            raise serializers.ValidationError("A ready report cannot include failures.")
        if data["state"] == "partial" and not (data["unmatched"] or data["errors"]):
            raise serializers.ValidationError(
                "A partial report must describe its failures."
            )
        return data


def accept_report(request, site, data):
    try:
        ticket = signing.loads(data["token"], salt=TICKET_SALT, max_age=TICKET_MAX_AGE)
        attempt = uuid.UUID(ticket["attempt"])
        issued_at = ticket["issued_at"]
        if (
            isinstance(issued_at, bool)
            or not isinstance(issued_at, (int, float))
            or not math.isfinite(issued_at)
            or ticket["site"] != site.pk
            or not -30 <= time.time() - issued_at <= TICKET_MAX_AGE
        ):
            raise ValueError("Invalid ticket scope")
    except (
        signing.BadSignature,
        ValueError,
        KeyError,
        TypeError,
        AttributeError,
        OverflowError,
    ) as exc:
        raise PermissionDenied(
            "The browser report ticket is invalid or expired. Reload the website."
        ) from exc
    context = report_context(request, site, private_path(data["page_path"]))
    if DeliveryReport.objects.filter(attempt_id=attempt).exists():
        return False
    if (
        data["version"] is not None
        and not ConfigVersion.objects.filter(
            site=site, version_no=data["version"], status__in=["published", "archived"]
        ).exists()
    ):
        raise serializers.ValidationError("Unknown published version for this website.")
    # Bound write volume, including when Redis is unavailable. Replayed tickets
    # cannot refresh the last-seen time or replace an earlier observation.
    bucket = f"connector:reports:{site.pk}:{int(time.time()) // 60}"
    try:
        if cache.add(bucket, 1, 70):
            count = 1
        else:
            count = cache.incr(bucket)
    except Exception:
        count = (
            DeliveryReport.objects.filter(
                site=site, received_at__gte=timezone.now() - timedelta(minutes=1)
            ).count()
            + 1
        )
    if count > REPORT_LIMIT:
        raise Throttled(wait=60, detail="Enough browser reports received this minute.")
    try:
        with transaction.atomic():
            DeliveryReport.objects.create(
                site=site,
                attempt_id=attempt,
                version_no=data["version"],
                revision=data["revision"],
                state=data["state"],
                context=context,
                page_path=private_path(data["page_path"]),
                applied=list(dict.fromkeys(data["applied"])),
                unmatched=data["unmatched"],
                errors=data["errors"],
                started_at=datetime.fromtimestamp(issued_at, tz=datetime_timezone.utc),
            )
    except IntegrityError:
        if DeliveryReport.objects.filter(attempt_id=attempt).exists():
            return False
        raise
    cutoff = list(
        DeliveryReport.objects.filter(site=site)
        .order_by("-id")
        .values_list("id", flat=True)[HISTORY_LIMIT - 1 : HISTORY_LIMIT]
    )
    if cutoff:
        DeliveryReport.objects.filter(site=site, id__lt=cutoff[0]).delete()
    return True


def serialize_report(report):
    if report is None:
        return None
    return {
        "id": report.pk,
        "version": report.version_no,
        "revision": report.revision,
        "state": report.state,
        "context": report.context,
        "page_path": report.page_path,
        "applied": report.applied,
        "unmatched": report.unmatched,
        "errors": report.errors,
        "started_at": report.started_at,
        "received_at": report.received_at,
    }


def delivery_status(site):
    config = getattr(site, "config", None)
    published = (
        config.published_version if config and config.published_version_id else None
    )
    revision = get_cached_payload(site)[0]["delivery_revision"] if published else None
    reports = DeliveryReport.objects.filter(site=site)
    latest = reports.filter(context="live").first()
    now = timezone.now()
    state, message = (
        "waiting",
        "Open or reload the connected website to receive its first browser report.",
    )
    if site.type != Site.Types.CONNECTED:
        state, message = (
            "unsupported",
            "Browser delivery reports are for connected websites.",
        )
    elif site.status != Site.Statuses.ACTIVE:
        state, message = (
            "inactive",
            "Activate this website in the CMS to deliver published changes.",
        )
    elif site.verification_status != Site.VerificationStatuses.VERIFIED:
        state, message = (
            "unverified",
            "Verify website ownership to enable browser delivery reports.",
        )
    elif published is None:
        state, message = (
            "unpublished",
            "Publish a version before checking whether the website applied it.",
        )
    elif latest:
        if latest.state == "error":
            state, message = (
                "error",
                "The latest reporting browser could not apply the configuration.",
            )
        elif latest.version_no != published.version_no:
            state, message = (
                "outdated",
                "The latest reporting browser loaded a different version. Reload the website.",
            )
        elif latest.revision != revision:
            state, message = (
                "changed",
                "The published settings or selector mappings changed after this report. "
                "Reload the website.",
            )
        elif latest.state == "partial":
            state, message = (
                "partial",
                "The latest version was reported, but some fields need attention.",
            )
        elif (now - latest.received_at).total_seconds() > FRESH_SECONDS:
            state, message = (
                "stale",
                "The latest version was reported earlier; no recent page load has reported back.",
            )
        else:
            state, message = (
                "reported",
                "A browser on the connected website reported applying the current version.",
            )
    return {
        "state": state,
        "message": message,
        "published_version": published.version_no if published else None,
        "version_created_at": published.created_at if published else None,
        "expected_revision": revision,
        "latest_report": serialize_report(latest),
        "latest_preview": serialize_report(reports.filter(context="preview").first()),
        "recent_reports": [serialize_report(report) for report in reports[:20]],
        "field_labels": FIELD_LABELS,
        "fresh_for_seconds": FRESH_SECONDS,
        "checked_at": now,
    }
