"""Site business logic. The only place that writes Sites (and their audit rows)."""

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import client_ip, log_action

from . import hosting
from .models import Site, SiteDomain


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
    # Phase 11: every site owns a primary verified alias mirroring its
    # canonical domain (extra aliases verify separately).
    hosting.ensure_primary_alias(site)
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
        from apps.connector.services import ensure_default_mappings

        ensure_default_mappings(site)
    return site


@transaction.atomic
def update_site(*, actor, site: Site, request=None, **fields) -> Site:
    before = site.to_snapshot()
    old_domain = site.domain
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
    if site.domain != old_domain:
        # Old hostname stays reachable as a verified alias; the new
        # canonical address becomes primary.
        hosting.ensure_primary_alias(site)
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


def _domain_names(site: Site) -> list:
    names = [site.domain]
    names.extend(site.domains.order_by("hostname").values_list("hostname", flat=True))
    return sorted(set(names))


@transaction.atomic
def add_site_domain(*, actor, site: Site, hostname: str, request=None) -> SiteDomain:
    """Attach an extra hostname to a built site (Phase 11 multi-alias).

    Managed subdomains are auto-verified (platform wildcard DNS); custom
    domains stay pending until the TXT check passes and do not serve traffic.
    """
    from apps.builder.services import require_built_site

    require_built_site(site)
    host = hosting.validate_public_hostname(hostname)
    kind = (
        SiteDomain.Kinds.MANAGED
        if hosting.is_managed_hostname(host)
        else SiteDomain.Kinds.CUSTOM
    )
    before = {"domains": _domain_names(site)}
    alias = SiteDomain.objects.create(
        site=site,
        hostname=host,
        kind=kind,
        verification_status=(
            SiteDomain.VerificationStatuses.VERIFIED
            if kind == SiteDomain.Kinds.MANAGED
            else SiteDomain.VerificationStatuses.PENDING
        ),
    )
    log_action(
        actor=actor,
        action=AuditLog.Actions.UPDATED,
        site=site,
        before=before,
        after={"domains": _domain_names(site)},
        ip_address=client_ip(request),
    )
    return alias


def check_site_domain(*, actor, alias: SiteDomain, request=None) -> SiteDomain:
    """Run the DNS TXT ownership check for a custom alias (synchronous)."""
    from .connect import check_dns_txt

    ok, detail = check_dns_txt(alias.hostname, alias.verification_token)
    alias.verification_error = "" if ok else detail[:2000]
    if ok:
        alias.verification_status = SiteDomain.VerificationStatuses.VERIFIED
        alias.verified_at = timezone.now()
        alias.save(
            update_fields=[
                "verification_status",
                "verification_error",
                "verified_at",
                "updated_at",
            ]
        )
        log_action(
            actor=actor,
            action=AuditLog.Actions.VERIFIED,
            site=alias.site,
            before={"hostname": alias.hostname, "verification_status": "pending"},
            after={"hostname": alias.hostname, "verification_status": "verified"},
            ip_address=client_ip(request),
        )
    else:
        alias.verification_status = SiteDomain.VerificationStatuses.FAILED
        alias.save(
            update_fields=["verification_status", "verification_error", "updated_at"]
        )
    return alias


@transaction.atomic
def set_primary_domain(*, actor, site: Site, alias: SiteDomain, request=None) -> Site:
    """Make a verified alias the canonical address (also updates Site.domain)."""
    if alias.site_id != site.pk:
        raise ValueError("Domain does not belong to this site.")
    if alias.verification_status != SiteDomain.VerificationStatuses.VERIFIED:
        raise ValueError("Only a verified domain can be primary.")
    before = {"domain": site.domain, "domains": _domain_names(site)}
    site.domains.update(is_primary=False)
    alias.is_primary = True
    alias.save(update_fields=["is_primary", "updated_at"])
    site.domain = alias.hostname
    site.save(update_fields=["domain", "updated_at"])
    cache.delete(f"builder:sitemap:{site.pk}")
    log_action(
        actor=actor,
        action=AuditLog.Actions.UPDATED,
        site=site,
        before=before,
        after={"domain": site.domain, "domains": _domain_names(site)},
        ip_address=client_ip(request),
    )
    return site


@transaction.atomic
def remove_site_domain(*, actor, site: Site, alias: SiteDomain, request=None) -> dict:
    if alias.site_id != site.pk:
        raise ValueError("Domain does not belong to this site.")
    if alias.is_primary or alias.hostname == hosting.normalize_hostname(site.domain):
        raise ValueError(
            "The primary domain cannot be removed. Set another primary first."
        )
    before = {"domains": _domain_names(site)}
    hostname = alias.hostname
    alias.delete()
    log_action(
        actor=actor,
        action=AuditLog.Actions.UPDATED,
        site=site,
        before=before,
        after={"domains": _domain_names(site)},
        ip_address=client_ip(request),
    )
    return {"hostname": hostname}


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
