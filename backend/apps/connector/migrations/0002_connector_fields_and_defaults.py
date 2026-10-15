from django.db import migrations, models


DEFAULTS = {
    "site_name": (
        '[data-cms="site-name"], header .navbar-brand strong, '
        "header .site-name, header .site-title, header .brand-name"
    ),
    "site_tagline": (
        '[data-cms="tagline"], header .navbar-brand small, header .site-tagline'
    ),
    "site_logo": '[data-cms="logo"], header .navbar-brand img, header img',
    "header_settings": '[data-cms="header"], header',
    "header_cta": (
        '[data-cms="header-cta"], header .header-cta, header .ms-auto > a.btn-primary'
    ),
    "navigation": (
        '[data-cms="navigation"], header .navbar-nav, '
        "header nav ul, header nav .ms-auto"
    ),
    "hero_eyebrow": '[data-cms="hero-eyebrow"], .hero-eyebrow, .hero p:first-child',
    "hero_heading": '[data-cms="hero-heading"], .hero-title, .hero h1',
    "hero_subheading": '[data-cms="hero-subheading"], .hero-subtitle, .hero p',
    "hero_background": '[data-cms="hero"], .hero-container, .hero',
    "hero_button": '[data-cms="hero-button"], .hero-actions a, .hero a',
    "hero_buttons": '[data-cms="hero-buttons"], .hero-actions, .hero .buttons',
    "footer_copyright": (
        '[data-cms="copyright"], footer .copyright, '
        "footer .footer-copyright, footer small, footer p"
    ),
    "footer_columns": '[data-cms="footer-columns"]',
    "footer_newsletter": '[data-cms="newsletter"], footer .newsletter',
    "social_links": '[data-cms="social-links"], footer .social-links',
    "favicon": 'link[rel="icon"]',
    "cover_image": '[data-cms="cover"], .cover img, .cover, .hero-container',
    "theme_colors": ":root",
}

LEGACY = {
    "site_logo": "header img",
    "header_cta": "header a:last-of-type",
    "hero_eyebrow": ".hero p:first-child",
    "hero_heading": ".hero h1, main h1, h1",
    "hero_subheading": ".hero p",
    "hero_background": ".hero",
    "hero_button": ".hero a",
    "footer_copyright": "footer",
    "cover_image": ".cover img",
}


def upgrade_defaults(apps, schema_editor):
    mapping = apps.get_model("connector", "SelectorMapping")
    for key, previous in LEGACY.items():
        # User-authored selectors and enabled/disabled choices are preserved.
        mapping.objects.filter(key=key, selector=previous).update(
            selector=DEFAULTS[key]
        )
    site_ids = list(
        mapping.objects.order_by().values_list("site_id", flat=True).distinct()
    )
    for site_id in site_ids:
        existing = set(
            mapping.objects.filter(site_id=site_id).values_list("key", flat=True)
        )
        mapping.objects.bulk_create(
            [
                mapping(site_id=site_id, key=key, selector=selector)
                for key, selector in DEFAULTS.items()
                if key not in existing
            ],
            ignore_conflicts=True,
        )


class Migration(migrations.Migration):
    dependencies = [("connector", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="selectormapping",
            name="key",
            field=models.CharField(
                max_length=32,
                choices=[
                    ("site_name", "Site name"),
                    ("site_tagline", "Site tagline"),
                    ("site_logo", "Site logo"),
                    ("header_settings", "Header layout / sticky"),
                    ("header_cta", "Header CTA"),
                    ("navigation", "Navigation links"),
                    ("hero_eyebrow", "Hero eyebrow"),
                    ("hero_heading", "Hero heading"),
                    ("hero_subheading", "Hero subheading"),
                    ("hero_background", "Hero background"),
                    ("hero_button", "Hero primary button"),
                    ("hero_buttons", "Hero button group"),
                    ("footer_copyright", "Footer copyright"),
                    ("footer_columns", "Footer link columns"),
                    ("footer_newsletter", "Existing newsletter form"),
                    ("social_links", "Social links"),
                    ("favicon", "Favicon"),
                    ("cover_image", "Cover image"),
                    ("theme_colors", "Theme colors"),
                ],
            ),
        ),
        migrations.RunPython(upgrade_defaults, migrations.RunPython.noop),
    ]
