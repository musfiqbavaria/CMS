"""Scheduled monitoring work (Beat owns the schedules; see migrations)."""

import logging
import subprocess
from datetime import datetime
from datetime import timezone as dt_timezone
from pathlib import Path

from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


def active_connected_sites():
    from apps.sites.models import Site

    return Site.objects.filter(status=Site.Statuses.ACTIVE, type=Site.Types.CONNECTED)


@shared_task(name="monitoring.check_site_uptime")
def check_site_uptime() -> dict:
    from apps.monitoring.services import check_uptime

    results = {"ok": 0, "fail": 0}
    for site in active_connected_sites():
        check = check_uptime(site)
        results["ok" if check.status == "ok" else "fail"] += 1
    return results


@shared_task(name="monitoring.check_ssl_expiry")
def check_ssl_expiry() -> dict:
    from apps.monitoring.services import check_ssl

    results = {"ok": 0, "fail": 0}
    for site in active_connected_sites():
        check = check_ssl(site)
        results["ok" if check.status == "ok" else "fail"] += 1
    return results


@shared_task(name="monitoring.check_connector_presence")
def check_connector_presence() -> dict:
    from apps.monitoring.services import check_connector

    results = {"ok": 0, "fail": 0}
    for site in active_connected_sites():
        check = check_connector(site)
        results["ok" if check.status == "ok" else "fail"] += 1
    return results


@shared_task(name="monitoring.refresh_all_sitemaps")
def refresh_all_sitemaps() -> dict:
    from apps.builder.tasks import generate_sitemap
    from apps.sites.models import Site

    queued = 0
    for site in Site.objects.filter(status=Site.Statuses.ACTIVE, type=Site.Types.BUILT):
        generate_sitemap.delay(site.pk)
        queued += 1
    return {"queued": queued}


@shared_task(name="monitoring.db_backup")
def db_backup() -> dict:
    """Portable JSON backup via dumpdata + retention. No pg_dump binary needed."""
    backup_dir = Path(getattr(settings, "BACKUP_DIR", "/vol/backups"))
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(dt_timezone.utc).strftime("%Y%m%d-%H%M%S")
    target = backup_dir / f"cms-{stamp}.json"
    with open(target, "w") as fh:
        subprocess.run(
            [
                "python",
                "manage.py",
                "dumpdata",
                "--natural-foreign",
                "--indent",
                "1",
                "accounts",
                "sites",
                "content",
                "builder",
                "connector",
                "monitoring",
                "audit",
                "django_celery_beat",
            ],
            check=True,
            stdout=fh,
            cwd="/app",
        )
    keep = int(getattr(settings, "BACKUP_KEEP_COUNT", 7))
    existing = sorted(backup_dir.glob("cms-*.json"))
    for old in existing[:-keep] if len(existing) > keep else []:
        old.unlink()
    return {"status": "backed_up", "file": target.name}


@shared_task(name="monitoring.cleanup_old")
def cleanup_old() -> dict:
    """Trim version history and stale health checks. Published versions are never removed."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.content.models import ConfigVersion
    from apps.monitoring.models import HealthCheck
    from apps.sites.models import Site

    keep = int(getattr(settings, "VERSION_KEEP_COUNT", 20))
    removed_versions = 0
    for site in Site.objects.all():
        ids = list(site.versions.order_by("-version_no").values_list("id", "status"))
        droppable = [
            vid for vid, st in ids[keep:] if st != ConfigVersion.Statuses.PUBLISHED
        ]
        removed, _ = ConfigVersion.objects.filter(pk__in=droppable).delete()
        removed_versions += removed
    cutoff = timezone.now() - timedelta(days=90)
    removed_checks, _ = HealthCheck.objects.filter(checked_at__lt=cutoff).delete()
    return {"versions_removed": removed_versions, "checks_removed": removed_checks}


@shared_task(name="monitoring.send_email")
def send_email(subject: str, message: str, recipients: list) -> dict:
    from django.core.mail import send_mail

    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, list(recipients))
    return {"status": "sent", "recipients": len(recipients)}
