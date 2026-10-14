"""Backfill: every existing site gets a primary verified alias = its domain."""

from django.conf import settings
from django.db import migrations


def backfill_primary_aliases(apps, schema_editor):
    Site = apps.get_model("sites", "Site")
    SiteDomain = apps.get_model("sites", "SiteDomain")
    base = (getattr(settings, "PLATFORM_BASE_DOMAIN", "") or "").strip().lower()
    for site in Site.objects.all().iterator():
        host = (site.domain or "").strip().lower()
        if not host:
            continue
        kind = (
            "managed"
            if base and (host == base or host.endswith("." + base))
            else "custom"
        )
        SiteDomain.objects.get_or_create(
            hostname=host,
            defaults={
                "site": site,
                "kind": kind,
                "is_primary": True,
                "verification_status": "verified",
            },
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("sites", "0004_sitedomain")]

    operations = [migrations.RunPython(backfill_primary_aliases, noop)]
