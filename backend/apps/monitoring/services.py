"""Monitoring logic: checks, transition notifications, retention."""

import socket
import ssl
import time

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone

from apps.core.ssrf import UnsafeURLError, safe_fetch
from apps.sites.models import Site

from .models import HealthCheck, Notification

NOTIFY_GROUP = "admin_notifications"
SSL_WARN_DAYS = 14


def last_status(site, check_type: str) -> str | None:
    latest = (
        site.health_checks.filter(check_type=check_type).order_by("-checked_at").first()
    )
    return latest.status if latest else None


def record_check(
    site, check_type: str, ok: bool, detail: dict, response_ms=None
) -> HealthCheck:
    return HealthCheck.objects.create(
        site=site,
        check_type=check_type,
        status=HealthCheck.Statuses.OK if ok else HealthCheck.Statuses.FAIL,
        detail=detail,
        response_ms=response_ms,
    )


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


def check_uptime(site: Site) -> HealthCheck:
    """Fetch the homepage. Notify on fail-transition and on recovery."""
    previous = last_status(site, HealthCheck.Types.UPTIME)
    started = time.monotonic()
    try:
        result = safe_fetch(f"https://{site.domain}")
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
    )
    if not ok and previous != HealthCheck.Statuses.FAIL:
        notify(
            site,
            Notification.Kinds.SITE_DOWN,
            f"{site.domain} is down",
            detail.get("error", f"HTTP {detail.get('status_code')}"),
        )
    if ok and previous == HealthCheck.Statuses.FAIL:
        notify(site, Notification.Kinds.SITE_RECOVERED, f"{site.domain} recovered")
    return check


def cert_expiry_seconds(cert: dict) -> float:
    return ssl.cert_time_to_seconds(cert["notAfter"])


def days_until(expiry_ts: float) -> int:
    return int((expiry_ts - timezone.now().timestamp()) / 86400)


def check_ssl(site: Site) -> HealthCheck:
    """Read the TLS certificate. Fail notifies; <14 days warns."""
    host = site.domain
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=host) as secure:
                cert = secure.getpeercert()
        days = days_until(cert_expiry_seconds(cert))
        ok = days >= 0
        detail: dict = {"days_left": days}
    except UnsafeURLError as exc:  # pragma: no cover - defensive; domain pre-validated
        return record_check(site, HealthCheck.Types.SSL, False, {"error": str(exc)})
    except Exception as exc:
        check = record_check(
            site, HealthCheck.Types.SSL, False, {"error": f"TLS failed: {exc}"}
        )
        # Always notify: unlike uptime flaps, a failed handshake means no expiry data at all.
        notify(
            site,
            Notification.Kinds.SSL_FAILED,
            f"TLS check failed for {host}",
            str(exc),
        )
        return check
    check = record_check(site, HealthCheck.Types.SSL, ok, detail)
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
