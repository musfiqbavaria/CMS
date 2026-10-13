"""Builder services: themes, slugging, section ordering, sitemap/robots builders."""

from django.core.exceptions import ValidationError
from django.utils.text import slugify

from apps.sites.models import Site

from .models import Theme

BUILTIN_THEMES = {
    "starter": {
        "name": "Starter",
        "description": "Clean default theme for content sites.",
        "settings": {
            "colors": {
                "primary": "#0f172a",
                "secondary": "#334155",
                "background": "#ffffff",
                "text": "#0f172a",
            },
            "fonts": {"heading": "system-ui", "body": "system-ui"},
            "radius": 8,
        },
    },
    "commerce": {
        "name": "Commerce",
        "description": "Warm storefront theme for shops.",
        "settings": {
            "colors": {
                "primary": "#9a3412",
                "secondary": "#44403c",
                "background": "#fffbeb",
                "text": "#1c1917",
            },
            "fonts": {"heading": "Georgia, serif", "body": "system-ui"},
            "radius": 12,
        },
    },
}


def ensure_builtin_themes() -> None:
    for slug, spec in BUILTIN_THEMES.items():
        Theme.objects.get_or_create(
            slug=slug,
            defaults={
                "name": spec["name"],
                "description": spec["description"],
                "settings": spec["settings"],
                "is_builtin": True,
            },
        )


def require_built_site(site: Site) -> None:
    if site.type != Site.Types.BUILT:
        raise ValidationError("Builder content belongs to built sites.")


def unique_slug(model, site, value: str, instance=None) -> str:
    base = slugify(value or "")[:200] or "item"
    slug = base
    counter = 2
    qs = model.objects.filter(site=site)
    if instance is not None:
        qs = qs.exclude(pk=instance.pk)
    while qs.filter(slug=slug).exists():
        slug = f"{base}-{counter}"
        counter += 1
    return slug


def reorder_sections(page, ids: list) -> None:
    """Apply an explicit section order (ids must cover the page's sections)."""
    current = list(page.sections.values_list("id", flat=True))
    if sorted(ids) != sorted(current):
        raise ValidationError("Order must contain exactly the page's section ids.")
    for position, section_id in enumerate(ids):
        page.sections.filter(pk=section_id).update(position=position)


def assign_theme(site: Site, theme: Theme) -> Site:
    site.theme = theme
    site.save(update_fields=["theme", "updated_at"])
    return site


def site_base_url(site: Site) -> str:
    return f"https://{site.domain}"


def iter_public_urls(site: Site):
    """(loc, lastmod) for every published routable object."""
    base = site_base_url(site)
    yield f"{base}/", None
    for page in site.pages.filter(status="published").exclude(slug__in=["", "home"]):
        yield f"{base}/{page.slug}/", page.updated_at
    for post in site.posts.filter(status="published"):
        yield f"{base}/blog/{post.slug}/", post.updated_at
    for product in site.products.filter(status="published"):
        yield f"{base}/shop/{product.slug}/", product.updated_at


def build_sitemap_xml(site: Site) -> str:
    urls = []
    for loc, lastmod in iter_public_urls(site):
        last = f"<lastmod>{lastmod.date().isoformat()}</lastmod>" if lastmod else ""
        urls.append(f"<url><loc>{loc}</loc>{last}</url>")
    joined = "".join(urls)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        f"{joined}</urlset>"
    )


def build_robots_txt(site: Site) -> str:
    return f"User-agent: *\nAllow: /\nSitemap: {site_base_url(site)}/sitemap.xml\n"
