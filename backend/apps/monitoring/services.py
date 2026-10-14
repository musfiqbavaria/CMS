"""Monitoring logic: checks, transition notifications, retention."""

import socket
import ssl
import time

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.utils import timezone

from apps.core.ssrf import UnsafeURLError, safe_fetch, validate_public_url
from apps.sites import hosting
from apps.sites.models import Site

from .models import HealthCheck, Notification

NOTIFY_GROUP = "admin_notifications"
SSL_WARN_DAYS = 14
SUMMARY_CACHE_KEY = "monitoring:summary"
SUMMARY_CACHE_TTL = 30


def monitored_hostnames(site: Site) -> list:
    """Every public hostname to probe: canonical domain + verified aliases."""
    names = [hosting.normalize_hostname(site.domain)]
    if site.type == Site.Types.BUILT:
        names.extend(
            site.domains.filter(verification_status="verified")
            .order_by("hostname")
            .values_list("hostname", flat=True)
        )
    seen = []
    for name in names:
        host = hosting.normalize_hostname(name)
        if host and host not in seen:
            seen.append(host)
    return seen


def monitoring_summary() -> list:
    """One row per active site with the latest check of each type.

    Checks are per (type, host); the row reports the worst state and carries
    a per-host breakdown. Bounded single-pass query (no per-site N+1), cached.
    """
    cached = cache.get(SUMMARY_CACHE_KEY)
    if cached is not None:
        return cached
    sites = list(Site.objects.filter(status=Site.Statuses.ACTIVE).order_by("name"))
    latest: dict = {}
    if sites:
        checks = (
            HealthCheck.objects.filter(site__in=[s.pk for s in sites])
            .order_by("site_id", "check_type", "host", "-checked_at")
            .values(
                "site_id",
                "check_type",
                "host",
                "status",
                "checked_at",
                "response_ms",
                "detail",
            )[:4000]
        )
        for check in checks:
            key = (check["site_id"], check["check_type"], check["host"])
            if key not in latest:
                latest[key] = check
    rows = []
    for site in sites:
        per_type = {}
        hosts: dict = {}
        for check_type, _ in HealthCheck.Types.choices:
            typed = [
                c
                for (s, t, _h), c in latest.items()
                if s == site.pk and t == check_type
            ]
            per_type[check_type] = (
                {
                    "status": (
                        "fail" if any(c["status"] == "fail" for c in typed) else "ok"
                    ),
                    "checked_at": (
                        max(c["checked_at"] for c in typed).isoformat()
                        if typed
                        else None
                    ),
                    "response_ms": next((c["response_ms"] for c in typed), None),
                    "detail": next((c["detail"] for c in typed), {}),
                    "hosts": sorted({c["host"] or site.domain for c in typed}),
                }
                if typed
                else None
            )
            for c in typed:
                host = c["host"] or site.domain
                hosts.setdefault(host, {})[check_type] = c["status"]
        for states in hosts.values():
            states["overall"] = "fail" if "fail" in states.values() else "ok"
        states = [v["status"] for v in per_type.values() if v]
        rows.append(
            {
                "site": site.pk,
                "name": site.name,
                "domain": site.domain,
                "type": site.type,
                "checks": per_type,
                "hosts": hosts,
                "overall": (
                    "fail" if "fail" in states else ("ok" if states else "unknown")
                ),
            }
        )
    cache.set(SUMMARY_CACHE_KEY, rows, SUMMARY_CACHE_TTL)
    return rows


def last_status(site, check_type: str, host: str = "") -> str | None:
    qs = site.health_checks.filter(check_type=check_type)
    if host:
        qs = qs.filter(host__iexact=host)
    latest = qs.order_by("-checked_at").first()
    return latest.status if latest else None


def record_check(
    site, check_type: str, ok: bool, detail: dict, response_ms=None, host: str = ""
) -> HealthCheck:
    check = HealthCheck.objects.create(
        site=site,
        check_type=check_type,
        host=hosting.normalize_hostname(host),
        status=HealthCheck.Statuses.OK if ok else HealthCheck.Statuses.FAIL,
        detail=detail,
        response_ms=response_ms,
    )
    cache.delete(SUMMARY_CACHE_KEY)
    return check


def push_notification(notification: Notification) -> None:
    async_to_sync(get_channel_layer().group_send)(
        NOTIFY_GROUP,
        {
            "type": "admin_notify",
            "id": notification.pk,
            "kind": notification.kind,
            "title": notification.title,
            "detail": notification.detail,
            "site": notification.site_id,
            "created_at": notification.created_at.isoformat(),
        },
    )


def notify(site, kind: str, title: str, detail: str = "") -> Notification:
    notification = Notification.objects.create(
        site=site, kind=kind, title=title, detail=detail
    )
    push_notification(notification)
    return notification


def check_uptime(site: Site, host: str | None = None) -> HealthCheck:
    """Fetch a public hostname's homepage. Notify on fail-transition and recovery."""
    host = hosting.normalize_hostname(host or site.domain)
    previous = last_status(site, HealthCheck.Types.UPTIME, host)
    started = time.monotonic()
    try:
        result = safe_fetch(f"https://{host}")
        ok = result.status_code < 400
        detail: dict = {"final_url": result.url, "status_code": result.status_code}
    except UnsafeURLError as exc:
        ok, detail = False, {"error": str(exc)}
    except Exception as exc:
        ok, detail = False, {"error": f"Fetch failed: {exc}"}
    check = record_check(
        site,
        HealthCheck.Types.UPTIME,
        ok,
        detail,
        int((time.monotonic() - started) * 1000),
        host,
    )
    if not ok and previous != HealthCheck.Statuses.FAIL:
        notify(
            site,
            Notification.Kinds.SITE_DOWN,
            f"{host} is down",
            detail.get("error", f"HTTP {detail.get('status_code')}"),
        )
    if ok and previous == HealthCheck.Statuses.FAIL:
        notify(site, Notification.Kinds.SITE_RECOVERED, f"{host} recovered")
    return check


def cert_expiry_seconds(cert: dict) -> float:
    return ssl.cert_time_to_seconds(cert["notAfter"])


def days_until(expiry_ts: float) -> int:
    return int((expiry_ts - timezone.now().timestamp()) / 86400)


def check_ssl(site: Site, host: str | None = None) -> HealthCheck:
    """Read a hostname's TLS certificate. Fail notifies; <14 days warns."""
    host = hosting.normalize_hostname(host or site.domain)
    try:
        validate_public_url(f"https://{host}")
    except UnsafeURLError as exc:
        return record_check(
            site, HealthCheck.Types.SSL, False, {"error": str(exc)}, host=host
        )
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=host) as secure:
                cert = secure.getpeercert()
        days = days_until(cert_expiry_seconds(cert))
        ok = days >= 0
        detail: dict = {"days_left": days}
    except Exception as exc:
        check = record_check(
            site,
            HealthCheck.Types.SSL,
            False,
            {"error": f"TLS failed: {exc}"},
            host=host,
        )
        # Always notify: unlike uptime flaps, a failed handshake means no expiry data at all.
        notify(
            site,
            Notification.Kinds.SSL_FAILED,
            f"TLS check failed for {host}",
            str(exc),
        )
        return check
    check = record_check(site, HealthCheck.Types.SSL, ok, detail, host=host)
    if not ok:
        notify(site, Notification.Kinds.SSL_FAILED, f"Certificate expired for {host}")
    elif days < SSL_WARN_DAYS:
        notify(
            site,
            Notification.Kinds.SSL_EXPIRING,
            f"Certificate for {host} expires in {days} days",
        )
    return check


def check_connector(site: Site) -> HealthCheck:
    """The published loader tag must be present on the homepage."""
    previous = last_status(site, HealthCheck.Types.CONNECTOR)
    try:
        result = safe_fetch(f"https://{site.domain}")
        present = "loader.js" in result.text and site.site_key in result.text
        detail: dict = {"present": present, "status_code": result.status_code}
        ok = present and result.status_code < 400
    except UnsafeURLError as exc:
        ok, detail = False, {"error": str(exc)}
    except Exception as exc:
        ok, detail = False, {"error": f"Fetch failed: {exc}"}
    check = record_check(site, HealthCheck.Types.CONNECTOR, ok, detail)
    if not ok and previous != HealthCheck.Statuses.FAIL:
        notify(
            site,
            Notification.Kinds.CONNECTOR_MISSING,
            f"Connector script missing on {site.domain}",
        )
    return check
