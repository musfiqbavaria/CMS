"""Site business logic. The only place that writes Sites (and their audit rows)."""

from django.db import transaction

from apps.audit.models import AuditLog
from apps.audit.services import client_ip, log_action

from .models import Site


def _snapshot(site: Site) -> dict:
    site.refresh_from_db()
    return site.to_snapshot()


@transaction.atomic
def create_site(
    *, actor, name: str, domain: str, type: str, integration_mode: str, request=None
) -> Site:
    site = Site.objects.create(
        name=name.strip(),
        domain=Site.normalize_domain(domain),
        type=type,
        integration_mode=integration_mode,
        created_by=actor,
    )
    log_action(
        actor=actor,
        action=AuditLog.Actions.CREATED,
        site=site,
        before={},
        after=_snapshot(site),
        ip_address=client_ip(request),
    )
    if site.type == Site.Types.CONNECTED:
        # Local import avoids a tasks -> services import cycle.
        from .tasks import discover_site

        transaction.on_commit(lambda: discover_site.delay(site.pk))
    return site


@transaction.atomic
def update_site(*, actor, site: Site, request=None, **fields) -> Site:
    before = site.to_snapshot()
    allowed = {"name", "domain", "type", "integration_mode"}
    for key, value in fields.items():
        if key not in allowed or value is None:
            continue
        if key == "domain":
            value = Site.normalize_domain(value)
        if key == "name":
            value = value.strip()
        setattr(site, key, value)
    site.save()
    log_action(
        actor=actor,
        action=AuditLog.Actions.UPDATED,
        site=site,
        before=before,
        after=_snapshot(site),
        ip_address=client_ip(request),
    )
    return site


@transaction.atomic
def delete_site(*, actor, site: Site, request=None) -> dict:
    """Delete the site but keep an audit row (FK nulled, domain snapshotted)."""
    before = site.to_snapshot()
    domain = site.domain
    entry = log_action(
        actor=actor,
        action=AuditLog.Actions.DELETED,
        site=site,
        before=before,
        after={},
        ip_address=client_ip(request),
    )
    site.delete()
    # Re-point the surviving audit row at the snapshot (site FK is SET_NULL).
    entry.site = None
    entry.object_id = str(before["id"])
    entry.site_display = domain
    entry.save(update_fields=["site", "object_id", "site_display"])
    return before


@transaction.atomic
def set_site_status(*, actor, site: Site, active: bool, request=None) -> Site:
    before = site.to_snapshot()
    if active:
        site.activate()
    else:
        site.deactivate()
    log_action(
        actor=actor,
        action=AuditLog.Actions.ACTIVATED if active else AuditLog.Actions.DEACTIVATED,
        site=site,
        before=before,
        after=_snapshot(site),
        ip_address=client_ip(request),
    )
    return site


@transaction.atomic
def bulk_action(*, actor, site_ids: list, action: str, request=None) -> dict:
    """Run activate/deactivate/delete over many sites; each row is audited."""
    if action not in {"activate", "deactivate", "delete"}:
        raise ValueError(f"Unknown bulk action: {action}")
    sites = list(Site.objects.filter(pk__in=site_ids))
    results = {"processed": 0, "missing": len(site_ids) - len(sites)}
    for site in sites:
        if action == "delete":
            delete_site(actor=actor, site=site, request=request)
        else:
            set_site_status(
                actor=actor, site=site, active=(action == "activate"), request=request
            )
        results["processed"] += 1
    return results
