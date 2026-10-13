"""Builder background work: sitemap warming (Beat schedules it in Phase 8)."""

from celery import shared_task
from django.core.cache import cache


@shared_task(name="builder.generate_sitemap")
def generate_sitemap(site_id: int) -> dict:
    from apps.builder import services
    from apps.sites.models import Site

    try:
        site = Site.objects.get(pk=site_id)
    except Site.DoesNotExist:
        return {"status": "skipped"}
    xml = services.build_sitemap_xml(site)
    cache.set(f"builder:sitemap:{site.domain}", xml, 86400)
    return {"status": "generated", "site_id": site_id, "urls": xml.count("<loc>")}
