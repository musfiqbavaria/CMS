"""Site content: editable draft/published config, immutable versions, media assets."""
from django.conf import settings
from django.db import models


class SiteConfig(models.Model):
    """One row per site. `draft` is edited; `published` is what the world sees."""

    site = models.OneToOneField("sites.Site", on_delete=models.CASCADE, related_name="config")
    draft = models.JSONField(default=dict, blank=True)
    published = models.JSONField(default=dict, blank=True)
    published_version = models.ForeignKey(
        "ConfigVersion", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"config for {self.site.domain}"


class ConfigVersion(models.Model):
    """Immutable snapshot. Exactly one published version per site (enforced in services)."""

    class Statuses(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    site = models.ForeignKey("sites.Site", on_delete=models.CASCADE, related_name="versions")
    version_no = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict)
    status = models.CharField(max_length=16, choices=Statuses.choices, default=Statuses.DRAFT)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    note = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["site", "version_no"], name="unique_site_version_no")
        ]
        indexes = [models.Index(fields=["site", "-version_no"])]
        ordering = ["-version_no"]

    def __str__(self) -> str:
        return f"{self.site.domain} v{self.version_no} ({self.status})"


class MediaAsset(models.Model):
    """Uploaded image. site=NULL means shared library visible to all sites."""

    site = models.ForeignKey(
        "sites.Site", null=True, blank=True, on_delete=models.CASCADE, related_name="media"
    )
    file = models.ImageField(upload_to="media/%Y/%m/")
    alt = models.CharField(max_length=255, blank=True, default="")
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    size = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["site", "-created_at"])]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.file.name
