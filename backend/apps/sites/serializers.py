from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from . import hosting
from .models import Site, SiteDomain


class SiteDomainSerializer(serializers.ModelSerializer):
    dns = serializers.SerializerMethodField()

    class Meta:
        model = SiteDomain
        fields = [
            "id",
            "hostname",
            "kind",
            "is_primary",
            "verification_status",
            "verification_error",
            "verified_at",
            "created_at",
            "dns",
        ]
        read_only_fields = [
            "id",
            "kind",
            "is_primary",
            "verification_status",
            "verification_error",
            "verified_at",
            "created_at",
            "dns",
        ]

    def get_dns(self, obj) -> dict | None:
        if obj.kind != SiteDomain.Kinds.CUSTOM:
            return None
        return hosting.dns_instructions(obj)


class SiteDomainCreateSerializer(serializers.Serializer):
    hostname = serializers.CharField(max_length=255)


class SiteSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )
    # Write-only: built sites may be created as <slug>.<PLATFORM_BASE_DOMAIN>.
    subdomain = serializers.CharField(required=False, allow_blank=True, write_only=True)
    is_managed = serializers.SerializerMethodField()
    public_url = serializers.SerializerMethodField()
    domains = SiteDomainSerializer(many=True, read_only=True)
    connector_origin = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = [
            "id",
            "name",
            "domain",
            "subdomain",
            "is_managed",
            "public_url",
            "domains",
            "homepage",
            "site_key",
            "connector_origin",
            "type",
            "status",
            "integration_mode",
            "verification_status",
            "verification_token",
            "verification_method",
            "verification_error",
            "verified_at",
            "discovery",
            "discovery_status",
            "discovery_error",
            "discovered_at",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {"domain": {"required": False, "allow_blank": True}}
        read_only_fields = [
            "id",
            "homepage",
            "site_key",
            "status",
            "verification_status",
            "verification_token",
            "verification_method",
            "verification_error",
            "verified_at",
            "discovery",
            "discovery_status",
            "discovery_error",
            "discovered_at",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]

    def validate_domain(self, value):
        if not (value or "").strip():
            # Blank is allowed at field level so validate() can compose the
            # domain from `subdomain`; presence is enforced there.
            return ""
        return hosting.validate_public_hostname(value, instance=self.instance)

    def get_is_managed(self, obj) -> bool:
        return hosting.is_managed_hostname(obj.domain)

    def get_connector_origin(self, obj) -> str:
        configured = getattr(settings, "CMS_PUBLIC_URL", "")
        if configured:
            return configured
        request = self.context.get("request")
        return request.build_absolute_uri("/").rstrip("/") if request else ""

    def get_public_url(self, obj) -> str:
        return hosting.canonical_url(obj)

    def validate(self, data):
        subdomain = (data.get("subdomain") or "").strip().lower()
        site_type = data.get("type") or (
            self.instance.type if self.instance else Site.Types.CONNECTED
        )
        if subdomain:
            if site_type != Site.Types.BUILT:
                raise serializers.ValidationError(
                    {"subdomain": "Free subdomains are only available for built sites."}
                )
            base = hosting.platform_base_domain()
            if not base:
                raise serializers.ValidationError(
                    {
                        "subdomain": "Free subdomains are not enabled: "
                        "set PLATFORM_BASE_DOMAIN."
                    }
                )
            from django.utils.text import slugify

            slug = slugify(subdomain)
            if not slug:
                raise serializers.ValidationError(
                    {"subdomain": "Enter a valid subdomain, e.g. myshop."}
                )
            composed = f"{slug}.{base}"
            if data.get("domain") and hosting.normalize_hostname(
                data["domain"]
            ) not in ("", composed):
                raise serializers.ValidationError(
                    {
                        "domain": "Provide either a subdomain or a custom domain, "
                        "not both."
                    }
                )
            data["domain"] = hosting.validate_public_hostname(
                composed, instance=self.instance
            )
        elif not self.instance and not (data.get("domain") or "").strip():
            if site_type == Site.Types.BUILT:
                # No address given: auto-allocate a free subdomain from the
                # name, resolved against this environment's base domain.
                try:
                    label = hosting.allocate_subdomain(
                        data.get("name")
                        or (self.instance.name if self.instance else ""),
                    )
                except DjangoValidationError as exc:
                    raise serializers.ValidationError(
                        {
                            "domain": "Enter a custom domain, or set "
                            "PLATFORM_BASE_DOMAIN to enable free subdomains."
                        }
                    ) from exc
                data["domain"] = hosting.validate_public_hostname(
                    f"{label}.{hosting.platform_base_domain()}",
                    instance=self.instance,
                )
            else:
                raise serializers.ValidationError(
                    {
                        "domain": "Domain is required. Use a subdomain or a custom domain."
                    }
                )
        data.pop("subdomain", None)
        return data

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Name is required.")
        return value.strip()


class BulkActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["activate", "deactivate", "delete"])
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), min_length=1, max_length=200
    )
