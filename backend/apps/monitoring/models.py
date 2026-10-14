"""Monitoring: health check history and admin notifications."""

from django.db import models


class HealthCheck(models.Model):
    class Types(models.TextChoices):
        UPTIME = "uptime", "Uptime"
        SSL = "ssl", "SSL expiry"
        CONNECTOR = "connector", "Connector presence"

    class Statuses(models.TextChoices):
        OK = "ok", "OK"
        FAIL = "fail", "Fail"

    site = models.ForeignKey(
        "sites.Site", on_delete=models.CASCADE, related_name="health_checks"
    )
    check_type = models.CharField(max_length=16, choices=Types.choices)
    # Public hostname that was actually probed (Phase 13 per-host monitoring).
    # Empty on rows written before per-host checks existed (= canonical domain).
    host = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=8, choices=Statuses.choices)
    detail = models.JSONField(default=dict, blank=True)
    response_ms = models.PositiveIntegerField(null=True, blank=True)
    checked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["site", "check_type", "-checked_at"]),
            models.Index(fields=["site", "check_type", "host", "-checked_at"]),
            models.Index(fields=["-checked_at"]),
        ]
        ordering = ["-checked_at"]

    def __str__(self) -> str:
        target = self.host or self.site.domain
        return f"{target} {self.check_type} {self.status}"


class Notification(models.Model):
    class Kinds(models.TextChoices):
        SITE_DOWN = "site_down", "Site down"
        SITE_RECOVERED = "site_recovered", "Site recovered"
        SSL_EXPIRING = "ssl_expiring", "SSL expiring"
        SSL_FAILED = "ssl_failed", "SSL check failed"
        CONNECTOR_MISSING = "connector_missing", "Connector missing"
        INFO = "info", "Info"

    site = models.ForeignKey(
        "sites.Site",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    kind = models.CharField(max_length=32, choices=Kinds.choices, default=Kinds.INFO)
    title = models.CharField(max_length=255)
    detail = models.TextField(blank=True, default="")
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["read", "-created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"[{self.kind}] {self.title}"
