"""Connector cache purge. Queued on publish/rollback/mapping changes."""

from celery import shared_task


@shared_task(name="connector.purge_cache")
def purge_connector_cache(site_id: int) -> dict:
    from apps.connector.services import purge_site_cache
    from apps.sites.models import Site

    try:
        site = Site.objects.get(pk=site_id)
    except Site.DoesNotExist:
        return {"status": "skipped"}
    purge_site_cache(site)
    return {"status": "purged", "site_id": site_id}
