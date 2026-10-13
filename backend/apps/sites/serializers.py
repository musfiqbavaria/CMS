from rest_framework import serializers

from .models import Site


class SiteSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )

    class Meta:
        model = Site
        fields = [
            "id",
            "name",
            "domain",
            "site_key",
            "type",
            "status",
            "integration_mode",
            "verification_status",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "site_key",
            "status",
            "verification_status",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
        ]

    def validate_domain(self, value):
        domain = Site.normalize_domain(value)
        if not domain or "." not in domain or " " in domain:
            raise serializers.ValidationError("Enter a valid domain, e.g. example.com.")
        qs = Site.objects.filter(domain=domain)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A site with this domain already exists.")
        return domain

    def validate_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("Name is required.")
        return value.strip()


class BulkActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["activate", "deactivate", "delete"])
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1), min_length=1, max_length=200
    )
