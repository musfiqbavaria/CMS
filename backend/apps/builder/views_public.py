"""Public rendering for built sites (resolved by Host header, no auth)."""

from django.core.cache import cache
from django.http import HttpResponse, HttpResponseNotFound

from . import rendering, services


def _site(request):
    return getattr(request, "built_site", None)


def _html(body: str, status=200) -> HttpResponse:
    resp = HttpResponse(body, content_type="text/html", status=status)
    resp["Cache-Control"] = "public, max-age=60"
    return resp


def home(request):
    site = _site(request)
    if site is None:
        return HttpResponseNotFound("<h1>Not found</h1>")
    return _html(rendering.render_home(site))


def page_detail(request, slug: str):
    site = _site(request)
    if site is None:
        return HttpResponseNotFound("<h1>Not found</h1>")
    try:
        page = site.pages.prefetch_related("sections").get(
            slug=slug, status="published"
        )
    except Exception:
        return _html(rendering.render_not_found(site), status=404)
    return _html(rendering.render_page(site, page))


def post_detail(request, slug: str):
    site = _site(request)
    if site is None:
        return HttpResponseNotFound("<h1>Not found</h1>")
    try:
        post = (
            site.posts.prefetch_related("tags")
            .select_related("category")
            .get(slug=slug, status="published")
        )
    except Exception:
        return _html(rendering.render_not_found(site), status=404)
    return _html(rendering.render_post(site, post))


def product_detail(request, slug: str):
    site = _site(request)
    if site is None:
        return HttpResponseNotFound("<h1>Not found</h1>")
    try:
        product = site.products.select_related("category").get(
            slug=slug, status="published"
        )
    except Exception:
        return _html(rendering.render_not_found(site), status=404)
    return _html(rendering.render_product(site, product))


def sitemap(request):
    site = _site(request)
    if site is None:
        return HttpResponseNotFound("Not found.", content_type="text/plain")
    key = f"builder:sitemap:{site.pk}"
    xml = cache.get(key)
    if xml is None:
        xml = services.build_sitemap_xml(site)
        cache.set(key, xml, 3600)
    return HttpResponse(xml, content_type="application/xml")


def robots(request):
    site = _site(request)
    if site is None:
        return HttpResponseNotFound("Not found.", content_type="text/plain")
    return HttpResponse(services.build_robots_txt(site), content_type="text/plain")
