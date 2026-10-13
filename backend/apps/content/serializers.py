from rest_framework import serializers

from .models import ConfigVersion, MediaAsset, SiteConfig


class SiteConfigSerializer(serializers.ModelSerializer):
    published_version_no = serializers.IntegerField(
        source="published_version.version_no", read_only=True, default=None
    )

    class Meta:
        model = SiteConfig
        fields = [
            "id",
            "site",
            "draft",
            "published",
            "published_version",
            "published_version_no",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "site",
            "published",
            "published_version",
            "published_version_no",
            "updated_by",
            "created_at",
            "updated_at",
        ]


class ConfigVersionSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(
        source="author.username", read_only=True, default=None
    )

    class Meta:
        model = ConfigVersion
        fields = [
            "id",
            "site",
            "version_no",
            "snapshot",
            "status",
            "author",
            "author_username",
            "note",
            "created_at",
        ]
        read_only_fields = fields


class SaveDraftSerializer(serializers.Serializer):
    note = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )


class PublishSerializer(serializers.Serializer):
    version_id = serializers.IntegerField(required=False, min_value=1)


class MediaAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    uploaded_by_username = serializers.CharField(
        source="uploaded_by.username", read_only=True, default=None
    )

    class Meta:
        model = MediaAsset
        fields = [
            "id",
            "site",
            "file",
            "url",
            "alt",
            "width",
            "height",
            "size",
            "uploaded_by",
            "uploaded_by_username",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "url",
            "width",
            "height",
            "size",
            "uploaded_by",
            "uploaded_by_username",
            "created_at",
        ]

    def get_url(self, obj):
        request = self.context.get("request")
        url = obj.file.url if obj.file else ""
        if request is not None and url:
            return request.build_absolute_uri(url)
        return url
