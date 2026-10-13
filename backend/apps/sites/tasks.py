"""Async site work: discovery snapshots and ownership verification."""

import logging

import requests
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="sites.discover_site", bind=True, max_retries=2)
def discover_site(self, site_id: int) -> dict:
    from .connect import DiscoveryError, discover_domain, mark_discovery, progress_event
    from .models import Site

    try:
        site = Site.objects.get(pk=site_id)
    except Site.DoesNotExist:
        logger.warning("discover_site: site %s gone, skipping", site_id)
        return {"status": "skipped"}

    mark_discovery(site, status="running")
    progress_event(site_id, "started")
    try:
        progress_event(site_id, "fetching")
        snapshot = discover_domain(site.domain)
    except DiscoveryError as exc:
        mark_discovery(site, status="failed", error=str(exc))
        progress_event(site_id, "failed", error=str(exc))
        return {"status": "failed", "error": str(exc)}
    except requests.RequestException as exc:
        # Transient network fault: retry with backoff, then fail.
        if self.request.retries < self.max_retries:
            progress_event(site_id, "retrying", error=str(exc))
            raise self.retry(exc=exc, countdown=10 * (2**self.request.retries))
        mark_discovery(site, status="failed", error=f"Fetch failed: {exc}")
        progress_event(site_id, "failed", error=str(exc))
        return {"status": "failed", "error": str(exc)}

    mark_discovery(site, status="succeeded", snapshot=snapshot)
    progress_event(site_id, "completed", snapshot=snapshot)
    return {"status": "succeeded", "site_id": site_id}


@shared_task(name="sites.verify_site_ownership")
def verify_site_ownership(site_id: int, method: str) -> dict:
    from .connect import (
        check_dns_txt,
        check_meta_tag,
        progress_event,
        record_verification,
    )
    from .models import Site

    try:
        site = Site.objects.get(pk=site_id)
    except Site.DoesNotExist:
        logger.warning("verify_site_ownership: site %s gone, skipping", site_id)
        return {"status": "skipped"}

    if method not in ("meta", "dns"):
        return {"status": "failed", "error": "Unknown method."}
    progress_event(site_id, "verifying", method=method)
    if method == "meta":
        ok, detail = check_meta_tag(site.domain, site.verification_token)
    else:
        ok, detail = check_dns_txt(site.domain, site.verification_token)
    record_verification(site, method=method, ok=ok, detail=detail)
    progress_event(
        site_id,
        "verified" if ok else "verification_failed",
        method=method,
        detail=detail,
    )
    return {"status": "verified" if ok else "failed", "detail": detail}
