"""Connector: selector mappings (admin) + public delivery (config, loader, proxy)."""

from django.db import models


class SelectorMapping(models.Model):
    """Maps a published config value onto the visitor's DOM via a CSS selector."""

    class Keys(models.TextChoices):
        SITE_NAME = "site_name", "Site name"
        SITE_TAGLINE = "site_tagline", "Site tagline"
        SITE_LOGO = "site_logo", "Site logo"
        HEADER_SETTINGS = "header_settings", "Header layout / sticky"
        HEADER_CTA = "header_cta", "Header CTA"
        NAVIGATION = "navigation", "Navigation links"
        HERO_EYEBROW = "hero_eyebrow", "Hero eyebrow"
        HERO_HEADING = "hero_heading", "Hero heading"
        HERO_SUBHEADING = "hero_subheading", "Hero subheading"
        HERO_BACKGROUND = "hero_background", "Hero background"
        HERO_BUTTON = "hero_button", "Hero primary button"
        HERO_BUTTONS = "hero_buttons", "Hero button group"
        FOOTER_COPYRIGHT = "footer_copyright", "Footer copyright"
        FOOTER_COLUMNS = "footer_columns", "Footer link columns"
        FOOTER_NEWSLETTER = "footer_newsletter", "Existing newsletter form"
        SOCIAL_LINKS = "social_links", "Social links"
        FAVICON = "favicon", "Favicon"
        COVER_IMAGE = "cover_image", "Cover image"
        THEME_COLORS = "theme_colors", "Theme colors"

    site = models.ForeignKey(
        "sites.Site", on_delete=models.CASCADE, related_name="mappings"
    )
    key = models.CharField(max_length=32, choices=Keys.choices)
    selector = models.CharField(max_length=255)
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["site", "key"], name="unique_site_mapping_key"
            )
        ]
        ordering = ["key"]

    def __str__(self) -> str:
        return f"{self.site.domain} {self.key} -> {self.selector}"


DEFAULT_SELECTORS = {
    SelectorMapping.Keys.SITE_NAME: (
        '[data-cms="site-name"], header .navbar-brand strong, '
        "header .site-name, header .site-title, header .brand-name"
    ),
    SelectorMapping.Keys.SITE_TAGLINE: (
        '[data-cms="tagline"], header .navbar-brand small, header .site-tagline'
    ),
    SelectorMapping.Keys.SITE_LOGO: (
        '[data-cms="logo"], header .navbar-brand img, header img'
    ),
    SelectorMapping.Keys.HEADER_SETTINGS: '[data-cms="header"], header',
    SelectorMapping.Keys.HEADER_CTA: (
        '[data-cms="header-cta"], header .header-cta, header .ms-auto > a.btn-primary'
    ),
    SelectorMapping.Keys.NAVIGATION: (
        '[data-cms="navigation"], header .navbar-nav, '
        "header nav ul, header nav .ms-auto"
    ),
    SelectorMapping.Keys.HERO_EYEBROW: (
        '[data-cms="hero-eyebrow"], .hero-eyebrow, .hero p:first-child'
    ),
    SelectorMapping.Keys.HERO_HEADING: (
        '[data-cms="hero-heading"], .hero-title, .hero h1'
    ),
    SelectorMapping.Keys.HERO_SUBHEADING: (
        '[data-cms="hero-subheading"], .hero-subtitle, .hero p'
    ),
    SelectorMapping.Keys.HERO_BACKGROUND: '[data-cms="hero"], .hero-container, .hero',
    SelectorMapping.Keys.HERO_BUTTON: (
        '[data-cms="hero-button"], .hero-actions a, .hero a'
    ),
    SelectorMapping.Keys.HERO_BUTTONS: (
        '[data-cms="hero-buttons"], .hero-actions, .hero .buttons'
    ),
    SelectorMapping.Keys.FOOTER_COPYRIGHT: (
        '[data-cms="copyright"], footer .copyright, '
        "footer .footer-copyright, footer small, footer p"
    ),
    SelectorMapping.Keys.FOOTER_COLUMNS: '[data-cms="footer-columns"]',
    SelectorMapping.Keys.FOOTER_NEWSLETTER: (
        '[data-cms="newsletter"], footer .newsletter'
    ),
    SelectorMapping.Keys.SOCIAL_LINKS: (
        '[data-cms="social-links"], footer .social-links'
    ),
    SelectorMapping.Keys.FAVICON: 'link[rel="icon"]',
    SelectorMapping.Keys.COVER_IMAGE: (
        '[data-cms="cover"], .cover img, .cover, .hero-container'
    ),
    SelectorMapping.Keys.THEME_COLORS: ":root",
}
