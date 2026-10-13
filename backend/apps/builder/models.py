"""Website builder: themes, pages/sections, posts, menus, products for built sites."""

from django.db import models


class Theme(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True, default="")
    settings = models.JSONField(default=dict, blank=True)
    is_builtin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class Page(models.Model):
    class Statuses(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    site = models.ForeignKey(
        "sites.Site", on_delete=models.CASCADE, related_name="pages"
    )
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    status = models.CharField(
        max_length=16, choices=Statuses.choices, default=Statuses.DRAFT
    )
    seo = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["site", "slug"], name="unique_site_page_slug"
            )
        ]
        indexes = [models.Index(fields=["site", "status"])]
        ordering = ["title"]

    def __str__(self) -> str:
        return f"{self.site.domain}/{self.slug or 'home'}"


class Section(models.Model):
    TYPES = [
        "hero",
        "features",
        "gallery",
        "testimonials",
        "pricing",
        "faq",
        "contact",
        "blog_list",
        "product_grid",
        "custom_html",
    ]

    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name="sections")
    type = models.CharField(max_length=32)
    position = models.PositiveIntegerField(default=0)
    settings = models.JSONField(default=dict, blank=True)
    enabled = models.BooleanField(default=True)

    class Meta:
        indexes = [models.Index(fields=["page", "position"])]
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return f"{self.page} #{self.position} {self.type}"


class PostCategory(models.Model):
    site = models.ForeignKey(
        "sites.Site", on_delete=models.CASCADE, related_name="post_categories"
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["site", "slug"], name="unique_site_postcat_slug"
            )
        ]

    def __str__(self) -> str:
        return self.name


class Tag(models.Model):
    site = models.ForeignKey(
        "sites.Site", on_delete=models.CASCADE, related_name="tags"
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["site", "slug"], name="unique_site_tag_slug"
            )
        ]

    def __str__(self) -> str:
        return self.name


class Post(models.Model):
    class Statuses(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    site = models.ForeignKey(
        "sites.Site", on_delete=models.CASCADE, related_name="posts"
    )
    category = models.ForeignKey(
        PostCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="posts",
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="posts")
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    excerpt = models.TextField(blank=True, default="")
    body = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=16, choices=Statuses.choices, default=Statuses.DRAFT
    )
    seo = models.JSONField(default=dict, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["site", "slug"], name="unique_site_post_slug"
            )
        ]
        indexes = [models.Index(fields=["site", "status", "-published_at"])]
        ordering = ["-published_at", "-id"]

    def __str__(self) -> str:
        return self.title


class Menu(models.Model):
    site = models.ForeignKey(
        "sites.Site", on_delete=models.CASCADE, related_name="menus"
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["site", "slug"], name="unique_site_menu_slug"
            )
        ]

    def __str__(self) -> str:
        return f"{self.site.domain} {self.name}"


class MenuItem(models.Model):
    menu = models.ForeignKey(Menu, on_delete=models.CASCADE, related_name="items")
    label = models.CharField(max_length=100)
    url = models.CharField(max_length=500)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return self.label


class ProductCategory(models.Model):
    site = models.ForeignKey(
        "sites.Site", on_delete=models.CASCADE, related_name="product_categories"
    )
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["site", "slug"], name="unique_site_prodcat_slug"
            )
        ]

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    class Statuses(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    site = models.ForeignKey(
        "sites.Site", on_delete=models.CASCADE, related_name="products"
    )
    category = models.ForeignKey(
        ProductCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="products",
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    description = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    compare_at = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    stock = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=16, choices=Statuses.choices, default=Statuses.DRAFT
    )
    images = models.JSONField(default=list, blank=True)
    variants = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["site", "slug"], name="unique_site_product_slug"
            )
        ]
        indexes = [models.Index(fields=["site", "status"])]
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
