"""Builder admin API: nested under /api/v1/sites/<site_pk>/builder/."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.sites.models import Site

from . import services
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
from .serializers import (
    MenuItemSerializer,
    MenuSerializer,
    PageSerializer,
    PostCategorySerializer,
    PostSerializer,
    ProductCategorySerializer,
    ProductSerializer,
    SectionSerializer,
    TagSerializer,
    ThemeSerializer,
    validation_error_response,
)


class SiteScopedMixin:
    def get_site(self) -> Site:
        site = get_object_or_404(Site, pk=self.kwargs["site_pk"])
        try:
            services.require_built_site(site)
        except DjangoValidationError as exc:
            raise _as_drf(exc)
        return site


def _as_drf(exc: DjangoValidationError):
    from rest_framework.exceptions import ValidationError

    return ValidationError(exc.messages if hasattr(exc, "messages") else [str(exc)])


class PageViewSet(SiteScopedMixin, GenericViewSet):
    serializer_class = PageSerializer
    queryset = Page.objects.all()

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .filter(site=self.get_site())
            .prefetch_related("sections")
        )

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "site": self.get_site()}

    def list(self, request, site_pk=None):
        qs = self.get_queryset()
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return Response(PageSerializer(qs, many=True).data)

    def create(self, request, site_pk=None):
        site = self.get_site()
        serializer = PageSerializer(data=request.data, context={"site": site})
        serializer.is_valid(raise_exception=True)
        page = Page.objects.create(site=site, **serializer.validated_data)
        return Response(PageSerializer(page).data, status=201)

    def retrieve(self, request, site_pk=None, pk=None):
        return Response(PageSerializer(self.get_queryset().get(pk=pk)).data)

    def partial_update(self, request, site_pk=None, pk=None):
        page = self.get_queryset().get(pk=pk)
        serializer = PageSerializer(
            page, data=request.data, partial=True, context={"site": page.site}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(PageSerializer(page).data)

    def destroy(self, request, site_pk=None, pk=None):
        self.get_queryset().get(pk=pk).delete()
        return Response(status=204)


class SectionViewSet(SiteScopedMixin, GenericViewSet):
    serializer_class = SectionSerializer

    def get_page(self) -> Page:
        return get_object_or_404(
            Page, pk=self.kwargs.get("page_pk"), site=self.get_site()
        )

    def get_section(self):
        return get_object_or_404(
            Section, pk=self.kwargs["pk"], page__site=self.get_site()
        )

    def list(self, request, site_pk=None, page_pk=None):
        sections = self.get_page().sections.all()
        return Response(SectionSerializer(sections, many=True).data)

    def create(self, request, site_pk=None, page_pk=None):
        page = self.get_page()
        serializer = SectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        section = page.sections.create(
            type=serializer.validated_data["type"],
            settings=serializer.validated_data.get("settings", {}),
            enabled=serializer.validated_data.get("enabled", True),
            position=page.sections.count(),
        )
        return Response(SectionSerializer(section).data, status=201)

    def partial_update(self, request, site_pk=None, pk=None, page_pk=None):
        section = self.get_section()
        serializer = SectionSerializer(section, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SectionSerializer(section).data)

    def destroy(self, request, site_pk=None, pk=None, page_pk=None):
        section = self.get_section()
        page = section.page
        section.delete()
        for i, s in enumerate(page.sections.order_by("position", "id")):
            s.position = i
            s.save(update_fields=["position"])
        return Response(status=204)

    def reorder(self, request, site_pk=None, page_pk=None):
        ids = request.data.get("ids", [])
        if not isinstance(ids, list) or not all(isinstance(i, int) for i in ids):
            return Response({"detail": "ids must be a list of ints."}, status=400)
        try:
            services.reorder_sections(self.get_page(), ids)
        except DjangoValidationError as exc:
            return validation_error_response(exc)
        return Response(
            SectionSerializer(self.get_page().sections.all(), many=True).data
        )


class _CrudViewSet(SiteScopedMixin, GenericViewSet):
    """List/create/retrieve/update/delete scoped to a site. Subclasses set model + serializer."""

    model = None
    serializer_class = None
    extra_list_filters: dict = {}

    def get_queryset(self):
        qs = self.model.objects.filter(site=self.get_site())
        for param, field in self.extra_list_filters.items():
            value = self.request.query_params.get(param)
            if value:
                qs = qs.filter(**{field: value})
        return qs

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "site": self.get_site()}

    def list(self, request, site_pk=None):
        return Response(self.serializer_class(self.get_queryset(), many=True).data)

    def create(self, request, site_pk=None):
        site = self.get_site()
        serializer = self.serializer_class(data=request.data, context={"site": site})
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        m2m = {}
        if "tags" in data:
            m2m["tags"] = data.pop("tags")
        obj = self.model.objects.create(site=site, **data)
        if m2m.get("tags") is not None:
            obj.tags.set(m2m["tags"])
        return Response(self.serializer_class(obj).data, status=201)

    def retrieve(self, request, site_pk=None, pk=None):
        return Response(self.serializer_class(self.get_queryset().get(pk=pk)).data)

    def partial_update(self, request, site_pk=None, pk=None):
        obj = self.get_queryset().get(pk=pk)
        serializer = self.serializer_class(
            obj, data=request.data, partial=True, context={"site": obj.site}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self.serializer_class(obj).data)

    def destroy(self, request, site_pk=None, pk=None):
        self.get_queryset().get(pk=pk).delete()
        return Response(status=204)


class PostViewSet(_CrudViewSet):
    model = Post
    serializer_class = PostSerializer
    extra_list_filters = {"status": "status", "category": "category_id"}

    def get_queryset(self):
        return (
            super().get_queryset().prefetch_related("tags").select_related("category")
        )


class MenuViewSet(_CrudViewSet):
    model = Menu
    serializer_class = MenuSerializer

    def get_queryset(self):
        return super().get_queryset().prefetch_related("items")


class ProductViewSet(_CrudViewSet):
    model = Product
    serializer_class = ProductSerializer
    extra_list_filters = {"status": "status", "category": "category_id"}

    def get_queryset(self):
        return super().get_queryset().select_related("category")


class SimpleViewSet(_CrudViewSet):
    """Name/slug models (categories, tags)."""

    def create(self, request, site_pk=None):
        site = self.get_site()
        serializer = self.serializer_class(data=request.data, context={"site": site})
        serializer.is_valid(raise_exception=True)
        obj = self.model.objects.create(site=site, **serializer.validated_data)
        return Response(self.serializer_class(obj).data, status=201)


class PostCategoryViewSet(SimpleViewSet):
    model = PostCategory
    serializer_class = PostCategorySerializer


class TagViewSet(SimpleViewSet):
    model = Tag
    serializer_class = TagSerializer


class ProductCategoryViewSet(SimpleViewSet):
    model = ProductCategory
    serializer_class = ProductCategorySerializer


class MenuItemViewSet(SiteScopedMixin, GenericViewSet):
    serializer_class = MenuItemSerializer

    def get_menu(self) -> Menu:
        return get_object_or_404(Menu, pk=self.kwargs["menu_pk"], site=self.get_site())

    def list(self, request, site_pk=None, menu_pk=None):
        return Response(MenuItemSerializer(self.get_menu().items.all(), many=True).data)

    def create(self, request, site_pk=None, menu_pk=None):
        menu = self.get_menu()
        serializer = MenuItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = menu.items.create(
            label=serializer.validated_data["label"],
            url=serializer.validated_data["url"],
            position=menu.items.count(),
        )
        return Response(MenuItemSerializer(item).data, status=201)

    def partial_update(self, request, site_pk=None, menu_pk=None, pk=None):
        item = get_object_or_404(MenuItem, pk=pk, menu=self.get_menu())
        serializer = MenuItemSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MenuItemSerializer(item).data)

    def destroy(self, request, site_pk=None, menu_pk=None, pk=None):
        item = get_object_or_404(MenuItem, pk=pk, menu=self.get_menu())
        menu = item.menu
        item.delete()
        for i, it in enumerate(menu.items.order_by("position", "id")):
            it.position = i
            it.save(update_fields=["position"])
        return Response(status=204)

    def reorder(self, request, site_pk=None, menu_pk=None):
        menu = self.get_menu()
        ids = request.data.get("ids", [])
        current = list(menu.items.values_list("id", flat=True))
        if not isinstance(ids, list) or sorted(ids) != sorted(current):
            return Response(
                {"detail": "ids must cover exactly the menu items."}, status=400
            )
        for position, item_id in enumerate(ids):
            menu.items.filter(pk=item_id).update(position=position)
        return Response(MenuItemSerializer(menu.items.all(), many=True).data)


class ThemeViewSet(GenericViewSet):
    """Global theme gallery (builtin + custom)."""

    serializer_class = ThemeSerializer
    queryset = Theme.objects.all()

    def list(self, request):
        services.ensure_builtin_themes()
        return Response(ThemeSerializer(Theme.objects.all(), many=True).data)

    def retrieve(self, request, pk=None):
        services.ensure_builtin_themes()
        return Response(ThemeSerializer(get_object_or_404(Theme, pk=pk)).data)


class SiteThemeView(SiteScopedMixin, GenericViewSet):
    def current(self, request, site_pk=None):
        site = self.get_site()
        return Response(
            {
                "theme": site.theme_id,
                "theme_name": site.theme.name if site.theme else None,
            }
        )

    def assign(self, request, site_pk=None):
        site = self.get_site()
        theme = get_object_or_404(Theme, pk=request.data.get("theme"))
        services.ensure_builtin_themes()
        services.assign_theme(site, theme)
        return Response({"theme": site.theme_id, "theme_name": theme.name})
