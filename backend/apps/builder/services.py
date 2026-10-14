"""Builder services: themes, slugging, section ordering, sitemap/robots builders."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.text import slugify

from apps.sites.models import Site

from .models import Menu, MenuItem, Page, Post, PostCategory, Section, Theme

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


# --- Section presets (Phase 14): every new section starts with editable
# sample content instead of a blank form. Explicit settings always win.
SECTION_PRESETS = {
    "hero": {
        "heading": "Welcome to our site",
        "subheading": "Tell visitors what you do in one clear sentence.",
        "background": "#f1f5f9",
        "primary_label": "Learn more",
        "primary_url": "/",
    },
    "features": {
        "title": "Features",
        "items": [
            {"title": "First benefit", "text": "Why it matters."},
            {"title": "Second benefit", "text": "Why it matters."},
            {"title": "Third benefit", "text": "Why it matters."},
        ],
    },
    "gallery": {"title": "Gallery", "images": []},
    "testimonials": {
        "title": "Testimonials",
        "items": [{"text": "A kind word from a customer.", "author": "Happy customer"}],
    },
    "pricing": {
        "title": "Pricing",
        "plans": [
            {"name": "Starter", "price": "$9", "blurb": "For trying things out."},
            {"name": "Pro", "price": "$29", "blurb": "For serious use."},
        ],
    },
    "faq": {
        "title": "FAQ",
        "items": [{"q": "How do we start?", "a": "Replace this with your answer."}],
    },
    "contact": {"email": "hello@example.com", "phone": "", "address": ""},
    "blog_list": {"title": "Latest posts", "count": 5},
    "product_grid": {"title": "Products", "count": 8},
    "custom_html": {"html": "<!-- Your HTML here -->"},
}


def default_section_settings(section_type: str, settings: dict | None) -> dict:
    """Merge caller settings over the preset so blanks become samples."""
    import copy

    preset = copy.deepcopy(SECTION_PRESETS.get(section_type, {}))
    for key, value in (settings or {}).items():
        if value not in (None, "", [], {}):
            preset[key] = value
    return preset


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


# --- Starter templates (Phase 12): one-click site skeletons. ---
#
# Each template declares published pages (with sections) plus a nav menu.
# Slugs go through unique_slug so applying never collides.

TEMPLATES = {
    "business": {
        "name": "Business",
        "description": "Hero, services, testimonials, FAQ and contact — for company sites.",
        "pages": [
            {
                "title": "Home",
                "slug": "home",
                "sections": [
                    {
                        "type": "hero",
                        "settings": {
                            "heading": "We help your business grow",
                            "subheading": "Services you can rely on, delivered on time.",
                            "primary_label": "Contact us",
                            "primary_url": "/contact/",
                        },
                    },
                    {
                        "type": "features",
                        "settings": {
                            "title": "Services",
                            "items": [
                                {
                                    "title": "Consulting",
                                    "text": "Expert advice for your next step.",
                                },
                                {
                                    "title": "Delivery",
                                    "text": "Fast, reliable execution.",
                                },
                                {
                                    "title": "Support",
                                    "text": "Help whenever you need it.",
                                },
                            ],
                        },
                    },
                    {
                        "type": "testimonials",
                        "settings": {
                            "title": "Customers",
                            "items": [
                                {
                                    "text": "Great to work with.",
                                    "author": "A happy customer",
                                }
                            ],
                        },
                    },
                ],
            },
            {
                "title": "Contact",
                "slug": "contact",
                "sections": [
                    {
                        "type": "contact",
                        "settings": {
                            "email": "hello@example.com",
                            "phone": "",
                            "address": "",
                        },
                    },
                    {
                        "type": "faq",
                        "settings": {
                            "title": "FAQ",
                            "items": [
                                {"q": "How do we start?", "a": "Send us a message."}
                            ],
                        },
                    },
                ],
            },
        ],
        "menu": {
            "name": "Main",
            "items": [
                {"label": "Home", "url": "/"},
                {"label": "Contact", "url": "/contact/"},
            ],
        },
    },
    "portfolio": {
        "name": "Portfolio",
        "description": "Hero, gallery and contact — show off creative work.",
        "pages": [
            {
                "title": "Home",
                "slug": "home",
                "sections": [
                    {
                        "type": "hero",
                        "settings": {
                            "heading": "Selected work",
                            "subheading": "A portfolio of recent projects.",
                            "primary_label": "Get in touch",
                            "primary_url": "/contact/",
                        },
                    },
                    {"type": "gallery", "settings": {"title": "Work", "images": []}},
                ],
            },
            {
                "title": "Contact",
                "slug": "contact",
                "sections": [
                    {
                        "type": "contact",
                        "settings": {
                            "email": "hello@example.com",
                            "phone": "",
                            "address": "",
                        },
                    },
                ],
            },
        ],
        "menu": {
            "name": "Main",
            "items": [
                {"label": "Home", "url": "/"},
                {"label": "Contact", "url": "/contact/"},
            ],
        },
    },
    "store": {
        "name": "Store",
        "description": "Hero, product grid, FAQ — start selling fast.",
        "pages": [
            {
                "title": "Home",
                "slug": "home",
                "sections": [
                    {
                        "type": "hero",
                        "settings": {
                            "heading": "New arrivals",
                            "subheading": "Quality products, fair prices.",
                            "primary_label": "Shop now",
                            "primary_url": "/",
                        },
                    },
                    {
                        "type": "product_grid",
                        "settings": {"title": "Featured", "count": 8},
                    },
                    {
                        "type": "faq",
                        "settings": {
                            "title": "Shipping & returns",
                            "items": [
                                {
                                    "q": "How long is delivery?",
                                    "a": "2–5 business days.",
                                }
                            ],
                        },
                    },
                ],
            },
        ],
        "menu": {"name": "Main", "items": [{"label": "Home", "url": "/"}]},
    },
    "restaurant": {
        "name": "Restaurant",
        "description": "Hero, specials, gallery, reviews and reservations.",
        "pages": [
            {
                "title": "Home",
                "slug": "home",
                "sections": [
                    {
                        "type": "hero",
                        "settings": {
                            "heading": "Fresh from our kitchen",
                            "subheading": "Seasonal dishes, warm hospitality.",
                            "primary_label": "Book a table",
                            "primary_url": "/contact/",
                        },
                    },
                    {
                        "type": "features",
                        "settings": {
                            "title": "Chef's specials",
                            "items": [
                                {"title": "Starter", "text": "Soup of the day."},
                                {"title": "Main", "text": "Grilled specials."},
                                {"title": "Dessert", "text": "Homemade sweets."},
                            ],
                        },
                    },
                    {"type": "gallery", "settings": {"title": "Inside", "images": []}},
                    {
                        "type": "testimonials",
                        "settings": {
                            "title": "Reviews",
                            "items": [
                                {"text": "Best dinner in town.", "author": "A regular"}
                            ],
                        },
                    },
                ],
            },
            {
                "title": "Contact",
                "slug": "contact",
                "sections": [
                    {
                        "type": "contact",
                        "settings": {
                            "email": "table@example.com",
                            "phone": "",
                            "address": "",
                        },
                    },
                ],
            },
        ],
        "menu": {
            "name": "Main",
            "items": [
                {"label": "Home", "url": "/"},
                {"label": "Contact", "url": "/contact/"},
            ],
        },
    },
    "blog": {
        "name": "Blog",
        "description": "Hero plus latest-posts feed, with sample category and posts.",
        "pages": [
            {
                "title": "Home",
                "slug": "home",
                "sections": [
                    {
                        "type": "hero",
                        "settings": {
                            "heading": "Notes & stories",
                            "subheading": "Thoughts worth sharing.",
                        },
                    },
                    {
                        "type": "blog_list",
                        "settings": {"title": "Latest posts", "count": 5},
                    },
                ],
            },
        ],
        "menu": {"name": "Main", "items": [{"label": "Home", "url": "/"}]},
        "post_category": "News",
        "posts": [
            {
                "title": "Hello world",
                "excerpt": "Our first post.",
                "body": "Welcome to the blog — replace this with your story.",
            },
            {
                "title": "Getting started",
                "excerpt": "How this site works.",
                "body": "Publish pages, write posts, and share the link.",
            },
        ],
    },
}


def list_templates() -> list:
    return [
        {
            "slug": slug,
            "name": spec["name"],
            "description": spec["description"],
            "pages": len(spec["pages"]),
        }
        for slug, spec in TEMPLATES.items()
    ]


@transaction.atomic
def apply_template(site: Site, slug: str, *, force: bool = False) -> dict:
    """Seed a built site from a starter template. Guarded, never merges."""
    require_built_site(site)
    spec = TEMPLATES.get(slug)
    if spec is None:
        raise ValidationError(f"Unknown template. Choices: {', '.join(TEMPLATES)}.")
    if site.pages.exists() and not force:
        raise ValidationError(
            "This site already has pages. Re-apply with force to replace them."
        )
    if force:
        site.menus.all().delete()
        site.pages.all().delete()
        site.homepage = None
    made_sections = 0
    home_page = None
    for page_spec in spec["pages"]:
        page = Page.objects.create(
            site=site,
            title=page_spec["title"],
            slug=unique_slug(Page, site, page_spec["slug"]),
            status=Page.Statuses.PUBLISHED,
        )
        if page_spec["slug"] == "home":
            home_page = page
        for position, section_spec in enumerate(page_spec.get("sections", [])):
            Section.objects.create(
                page=page,
                type=section_spec["type"],
                position=position,
                settings=section_spec.get("settings", {}),
            )
            made_sections += 1
    menu_spec = spec.get("menu")
    if menu_spec:
        menu = Menu.objects.create(
            site=site,
            name=menu_spec["name"],
            slug=unique_slug(Menu, site, menu_spec["name"]),
        )
        for position, item in enumerate(menu_spec.get("items", [])):
            MenuItem.objects.create(
                menu=menu, label=item["label"], url=item["url"], position=position
            )
    made_posts = 0
    if spec.get("posts"):
        category = PostCategory.objects.create(
            site=site,
            name=spec.get("post_category", "General"),
            slug=unique_slug(
                PostCategory, site, spec.get("post_category", "General")
            ),
        )
        for post_spec in spec["posts"]:
            Post.objects.create(
                site=site,
                category=category,
                title=post_spec["title"],
                slug=unique_slug(Post, site, post_spec["title"]),
                excerpt=post_spec.get("excerpt", ""),
                body=post_spec.get("body", ""),
                status=Post.Statuses.PUBLISHED,
            )
            made_posts += 1
    if home_page is not None and site.homepage_id is None:
        site.homepage = home_page
        site.save(update_fields=["homepage", "updated_at"])
    return {
        "template": slug,
        "pages": len(spec["pages"]),
        "sections": made_sections,
        "menu": bool(menu_spec),
        "posts": made_posts,
        "homepage": home_page.slug if home_page else None,
    }


def set_homepage(site: Site, page_id: int) -> Site:
    """Serve a published page of this site at the site root."""
    require_built_site(site)
    try:
        page = site.pages.get(pk=page_id)
    except Page.DoesNotExist:
        raise ValidationError("Page not found on this site.")
    if page.status != Page.Statuses.PUBLISHED:
        raise ValidationError("Only a published page can be the homepage.")
    site.homepage = page
    site.save(update_fields=["homepage", "updated_at"])
    return site
