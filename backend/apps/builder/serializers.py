from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import (
    Menu,
    MenuItem,
    Page,
    Post,
    PostCategory,
    Product,
    ProductCategory,
    Section,
    Tag,
    Theme,
)
from .services import require_built_site, unique_slug


class ThemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Theme
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "settings",
            "is_builtin",
            "created_at",
        ]
        read_only_fields = ["id", "is_builtin", "created_at"]


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "page", "type", "position", "settings", "enabled"]
        read_only_fields = ["id", "page", "position"]

    def validate_type(self, value):
        if value not in Section.TYPES:
            raise serializers.ValidationError(
                f"Unknown section type. Choices: {', '.join(Section.TYPES)}."
            )
        return value


class PageSerializer(serializers.ModelSerializer):
    sections_count = serializers.IntegerField(source="sections.count", read_only=True)

    class Meta:
        model = Page
        fields = [
            "id",
            "site",
            "title",
            "slug",
            "status",
            "seo",
            "sections_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "site", "sections_count", "created_at", "updated_at"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def validate(self, attrs):
        site = self.context["site"]
        require_built_site(site)
        slug = attrs.get("slug") or attrs.get("title", "")
        from django.utils.text import slugify

        attrs["slug"] = unique_slug(Page, site, slugify(slug), instance=self.instance)
        return attrs


class PostCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PostCategory
        fields = ["id", "site", "name", "slug"]
        read_only_fields = ["id", "site"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def validate(self, attrs):
        site = self.context["site"]
        attrs["slug"] = unique_slug(
            PostCategory, site, attrs.get("slug") or attrs.get("name", "")
        )
        return attrs


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "site", "name", "slug"]
        read_only_fields = ["id", "site"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}


class PostSerializer(serializers.ModelSerializer):
    tags = serializers.SlugRelatedField(
        many=True, slug_field="slug", queryset=Tag.objects.all(), required=False
    )
    category_name = serializers.CharField(
        source="category.name", read_only=True, default=None
    )

    class Meta:
        model = Post
        fields = [
            "id",
            "site",
            "title",
            "slug",
            "excerpt",
            "body",
            "status",
            "seo",
            "category",
            "category_name",
            "tags",
            "published_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "site", "category_name", "created_at", "updated_at"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def validate(self, attrs):
        site = self.context["site"]
        require_built_site(site)
        attrs["slug"] = unique_slug(
            Post,
            site,
            attrs.get("slug") or attrs.get("title", ""),
            instance=self.instance,
        )
        tags = attrs.get("tags", None)
        if tags is not None:
            for tag in tags:
                if tag.site_id != site.pk:
                    raise serializers.ValidationError(
                        {"tags": "Tags must belong to the same site."}
                    )
        category = attrs.get("category")
        if category is not None and category.site_id != site.pk:
            raise serializers.ValidationError(
                {"category": "Category must belong to the same site."}
            )
        return attrs


class MenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = ["id", "menu", "label", "url", "position"]
        read_only_fields = ["id", "menu", "position"]


class MenuSerializer(serializers.ModelSerializer):
    items = MenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = Menu
        fields = ["id", "site", "name", "slug", "items"]
        read_only_fields = ["id", "site", "items"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def validate(self, attrs):
        site = self.context["site"]
        require_built_site(site)
        attrs["slug"] = unique_slug(
            Menu,
            site,
            attrs.get("slug") or attrs.get("name", ""),
            instance=self.instance,
        )
        return attrs


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = ["id", "site", "name", "slug"]
        read_only_fields = ["id", "site"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def validate(self, attrs):
        site = self.context["site"]
        attrs["slug"] = unique_slug(
            ProductCategory, site, attrs.get("slug") or attrs.get("name", "")
        )
        return attrs


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name", read_only=True, default=None
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "site",
            "name",
            "slug",
            "description",
            "price",
            "compare_at",
            "stock",
            "status",
            "images",
            "variants",
            "category",
            "category_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "site", "category_name", "created_at", "updated_at"]
        extra_kwargs = {"slug": {"required": False, "allow_blank": True}}

    def validate_price(self, value):
        if value is not None and Decimal(value) < 0:
            raise serializers.ValidationError("Price cannot be negative.")
        return value

    def validate_stock(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Stock cannot be negative.")
        return value

    def validate(self, attrs):
        site = self.context["site"]
        require_built_site(site)
        attrs["slug"] = unique_slug(
            Product,
            site,
            attrs.get("slug") or attrs.get("name", ""),
            instance=self.instance,
        )
        category = attrs.get("category")
        if category is not None and category.site_id != site.pk:
            raise serializers.ValidationError(
                {"category": "Category must belong to the same site."}
            )
        for field in ("images", "variants"):
            if field in attrs and not isinstance(attrs[field], list):
                raise serializers.ValidationError({field: "Must be a list."})
        return attrs


def validation_error_response(exc: DjangoValidationError):
    from rest_framework.response import Response

    return Response(
        {"detail": exc.messages if hasattr(exc, "messages") else [str(exc)]}, status=400
    )
