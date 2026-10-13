"""Audit trail: who did what to which site, with before/after JSON."""

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Append-only. Rows are never updated; retention cleanup arrives in Phase 8."""

    class Actions(models.TextChoices):
        CREATED = "created", "Created"
        UPDATED = "updated", "Updated"
        DELETED = "deleted", "Deleted"
        ACTIVATED = "activated", "Activated"
        DEACTIVATED = "deactivated", "Deactivated"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=16, choices=Actions.choices)
    model = models.CharField(max_length=64, default="site")
    object_id = models.CharField(max_length=64)
    site = models.ForeignKey(
        "sites.Site",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    site_display = models.CharField(max_length=255, default="", blank=True)
    before = models.JSONField(default=dict, blank=True)
    after = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["site", "-created_at"]),
            models.Index(fields=["actor", "-created_at"]),
            models.Index(fields=["-created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.action} {self.model}#{self.object_id} by {self.actor}"
