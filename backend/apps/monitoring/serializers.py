from rest_framework import serializers

from .models import HealthCheck, Notification


class HealthCheckSerializer(serializers.ModelSerializer):
    site_domain = serializers.CharField(source="site.domain", read_only=True)

    class Meta:
        model = HealthCheck
        fields = [
            "id",
            "site",
            "site_domain",
            "check_type",
            "status",
            "detail",
            "response_ms",
            "checked_at",
        ]
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    site_domain = serializers.CharField(
        source="site.domain", read_only=True, default=None
    )

    class Meta:
        model = Notification
        fields = [
            "id",
            "site",
            "site_domain",
            "kind",
            "title",
            "detail",
            "read",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "site",
            "site_domain",
            "kind",
            "title",
            "detail",
            "created_at",
        ]
