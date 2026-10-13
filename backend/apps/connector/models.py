"""Connector: selector mappings (admin) + public delivery (config, loader, proxy)."""

from django.db import models


class SelectorMapping(models.Model):
    """Maps a published config value onto the visitor's DOM via a CSS selector."""

    class Keys(models.TextChoices):
        SITE_LOGO = "site_logo", "Site logo"
        HEADER_CTA = "header_cta", "Header CTA"
        HERO_EYEBROW = "hero_eyebrow", "Hero eyebrow"
        HERO_HEADING = "hero_heading", "Hero heading"
        HERO_SUBHEADING = "hero_subheading", "Hero subheading"
        HERO_BACKGROUND = "hero_background", "Hero background"
        HERO_BUTTON = "hero_button", "Hero primary button"
        FOOTER_COPYRIGHT = "footer_copyright", "Footer copyright"
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
    SelectorMapping.Keys.SITE_LOGO: "header img",
    SelectorMapping.Keys.HEADER_CTA: "header a:last-of-type",
    SelectorMapping.Keys.HERO_EYEBROW: ".hero p:first-child",
    SelectorMapping.Keys.HERO_HEADING: ".hero h1, main h1, h1",
    SelectorMapping.Keys.HERO_SUBHEADING: ".hero p",
    SelectorMapping.Keys.HERO_BACKGROUND: ".hero",
    SelectorMapping.Keys.HERO_BUTTON: ".hero a",
    SelectorMapping.Keys.FOOTER_COPYRIGHT: "footer",
    SelectorMapping.Keys.FAVICON: 'link[rel="icon"]',
    SelectorMapping.Keys.COVER_IMAGE: ".cover img",
    SelectorMapping.Keys.THEME_COLORS: ":root",
}
