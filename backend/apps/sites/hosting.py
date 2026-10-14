"""Hosted-site addressing: free subdomains under PLATFORM_BASE_DOMAIN + custom domains.

Phase 10 keeps one canonical public hostname per site (``Site.domain``) while
letting built sites be created either as ``<slug>.<base>`` or on a custom
domain. Everything is served from this same host (Nginx ``server_name _`` +
``BuilderDomainMiddleware``), Google-Sites style. Multi-alias hostnames
(site reachable on subdomain AND custom domain) arrive in Phase 11.
"""

import re

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.text import slugify
from rest_framework import serializers as drf_serializers

HOST_RE = re.compile(r"^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")

RESERVED_SUBDOMAINS = frozenset(
    {
        "www",
        "api",
        "admin",
        "app",
        "cms",
        "static",
        "media",
        "mail",
        "ftp",
        "blog",
        "shop",
        "staging",
        "dev",
        "test",
        "support",
        "help",
        "status",
        "cdn",
    }
)


def platform_base_domain() -> str:
    return (
        (getattr(settings, "PLATFORM_BASE_DOMAIN", "") or "")
        .strip()
        .lower()
        .rstrip(".")
    )


def normalize_hostname(raw: str) -> str:
    value = (raw or "").strip().lower()
    for prefix in ("https://", "http://"):
        if value.startswith(prefix):
            value = value[len(prefix) :]
    value = value.split("/")[0].split("?")[0].split("#")[0].strip()
    if ":" in value and not value.startswith("["):
        value = value.split(":")[0]
    return value.rstrip(".")


def is_managed_hostname(host: str) -> bool:
    base = platform_base_domain()
    host = normalize_hostname(host)
    return bool(base) and (host == base or host.endswith("." + base))


def subdomain_label(host: str) -> str:
    base = platform_base_domain()
    host = normalize_hostname(host)
    if base and host != base and host.endswith("." + base):
        return host[: -(len(base) + 1)]
    return ""


def canonical_url(site) -> str:
    return f"https://{normalize_hostname(site.domain)}"


def validate_public_hostname(value: str, *, instance=None) -> str:
    """Normalize + validate any public hostname (managed subdomain or custom)."""
    from apps.sites.models import Site

    host = normalize_hostname(value)
    if not host or " " in host or "." not in host:
        raise drf_serializers.ValidationError("Enter a valid domain, e.g. example.com.")
    if not HOST_RE.match(host):
        raise drf_serializers.ValidationError(
            "Use a valid hostname: lowercase letters, numbers, hyphens and dots."
        )
    base = platform_base_domain()
    if base:
        if host == base or host == f"www.{base}":
            raise drf_serializers.ValidationError(
                f'"{host}" is reserved for the platform. '
                f"Use a subdomain like mysite.{base} or a custom domain."
            )
        if host.endswith("." + base):
            label = subdomain_label(host)
            if not label:
                raise drf_serializers.ValidationError("Subdomain must not be empty.")
            if len(label) > 63:
                raise drf_serializers.ValidationError(
                    "Subdomain must be 63 characters or fewer."
                )
            if label in RESERVED_SUBDOMAINS:
                raise drf_serializers.ValidationError(
                    f'"{label}" is reserved. Pick another subdomain.'
                )
            if slugify(label) != label:
                raise drf_serializers.ValidationError(
                    "Subdomain may only use lowercase letters, numbers and hyphens."
                )
    qs = Site.objects.filter(domain__iexact=host)
    if instance is not None:
        qs = qs.exclude(pk=instance.pk)
    if qs.exists():
        raise drf_serializers.ValidationError(
            "A site with this address already exists."
        )
    return host


def allocate_subdomain(name: str, *, exclude_pk=None) -> str:
    """Return a free subdomain label under the platform base domain."""
    from apps.sites.models import Site

    base = platform_base_domain()
    if not base:
        raise DjangoValidationError(
            "Free subdomains are not enabled: set PLATFORM_BASE_DOMAIN."
        )
    stem = slugify(name or "")[:63].strip("-") or "site"
    label, counter = stem, 2
    for _ in range(1000):
        qs = Site.objects.filter(domain__iexact=f"{label}.{base}")
        if exclude_pk is not None:
            qs = qs.exclude(pk=exclude_pk)
        if not qs.exists() and label not in RESERVED_SUBDOMAINS:
            return label
        label = f"{stem}-{counter}"
        counter += 1
    raise DjangoValidationError(
        "Could not allocate a free subdomain. Try another name."
    )
