"""Registered sites: connected external domains and CMS-built sites."""

import secrets

from django.conf import settings
from django.db import models


def generate_site_key() -> str:
    return secrets.token_urlsafe(24)


def generate_verification_token() -> str:
    return secrets.token_urlsafe(32)


class Site(models.Model):
    """One row per managed website. Discovery/verification detail lands in Phase 4."""

    class Types(models.TextChoices):
        CONNECTED = "connected", "Connected"
        BUILT = "built", "Built"

    class Statuses(models.TextChoices):
        PENDING = "pending", "Pending"
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    class VerificationStatuses(models.TextChoices):
        PENDING = "pending", "Pending"
        VERIFIED = "verified", "Verified"
        FAILED = "failed", "Failed"

    class IntegrationModes(models.TextChoices):
        CONNECTOR = "connector", "Connector Script"
        PROXY = "proxy", "Reverse Proxy"

    name = models.CharField(max_length=255)
    domain = models.CharField(max_length=255, unique=True)
    site_key = models.CharField(
        max_length=64, unique=True, default=generate_site_key, editable=False
    )
    type = models.CharField(
        max_length=16, choices=Types.choices, default=Types.CONNECTED
    )
    status = models.CharField(
        max_length=16, choices=Statuses.choices, default=Statuses.PENDING
    )
    integration_mode = models.CharField(
        max_length=16,
        choices=IntegrationModes.choices,
        default=IntegrationModes.CONNECTOR,
    )
    verification_status = models.CharField(
        max_length=16,
        choices=VerificationStatuses.choices,
        default=VerificationStatuses.PENDING,
    )
    verification_token = models.CharField(
        max_length=64, default=generate_verification_token, editable=False
    )
    verification_method = models.CharField(max_length=8, blank=True, default="")
    verification_error = models.TextField(blank=True, default="")
    verified_at = models.DateTimeField(null=True, blank=True)
    discovery = models.JSONField(default=dict, blank=True)
    discovery_status = models.CharField(max_length=16, default="pending")
    discovery_error = models.TextField(blank=True, default="")
    discovered_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="sites",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["domain"]),
            models.Index(fields=["status"]),
            models.Index(fields=["type"]),
            models.Index(fields=["-created_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.domain})"

    def to_snapshot(self) -> dict:
        """JSON-safe snapshot for audit before/after payloads."""
        return {
            "id": self.pk,
            "name": self.name,
            "domain": self.domain,
            "type": self.type,
            "status": self.status,
            "integration_mode": self.integration_mode,
            "verification_status": self.verification_status,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    @staticmethod
    def normalize_domain(raw: str) -> str:
        """Lowercase bare hostname. Full URL validation lives in Phase 4."""
        value = (raw or "").strip().lower()
        for prefix in ("https://", "http://"):
            if value.startswith(prefix):
                value = value[len(prefix) :]
        return value.split("/")[0].split("?")[0].strip().rstrip(".")

    def activate(self) -> None:
        self.status = self.Statuses.ACTIVE
        self.save(update_fields=["status", "updated_at"])

    def deactivate(self) -> None:
        self.status = self.Statuses.INACTIVE
        self.save(update_fields=["status", "updated_at"])
