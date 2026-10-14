from django.urls import path

from .views import (
    MenuItemViewSet,
    MenuViewSet,
    PageViewSet,
    PostCategoryViewSet,
    PostViewSet,
    ProductCategoryViewSet,
    ProductViewSet,
    SectionViewSet,
    SiteThemeView,
    SiteStarterView,
    TagViewSet,
    ThemeViewSet,
)

page_list = PageViewSet.as_view({"get": "list", "post": "create"})
page_detail = PageViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
section_list = SectionViewSet.as_view({"get": "list", "post": "create"})
section_detail = SectionViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
section_reorder = SectionViewSet.as_view({"post": "reorder"})
post_list = PostViewSet.as_view({"get": "list", "post": "create"})
post_detail = PostViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
postcat_list = PostCategoryViewSet.as_view({"get": "list", "post": "create"})
postcat_detail = PostCategoryViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
tag_list = TagViewSet.as_view({"get": "list", "post": "create"})
tag_detail = TagViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
menu_list = MenuViewSet.as_view({"get": "list", "post": "create"})
menu_detail = MenuViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
menuitem_list = MenuItemViewSet.as_view({"get": "list", "post": "create"})
menuitem_detail = MenuItemViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
menuitem_reorder = MenuItemViewSet.as_view({"post": "reorder"})
prodcat_list = ProductCategoryViewSet.as_view({"get": "list", "post": "create"})
prodcat_detail = ProductCategoryViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
product_list = ProductViewSet.as_view({"get": "list", "post": "create"})
product_detail = ProductViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
theme_list = ThemeViewSet.as_view({"get": "list"})
theme_detail = ThemeViewSet.as_view({"get": "retrieve"})
site_theme = SiteThemeView.as_view({"get": "current", "post": "assign"})
starter_list = SiteStarterView.as_view({"get": "templates"})
starter_apply = SiteStarterView.as_view({"post": "apply"})
starter_homepage = SiteStarterView.as_view({"post": "homepage"})

urlpatterns = [
    path("sites/<int:site_pk>/builder/pages/", page_list),
    path("sites/<int:site_pk>/builder/pages/<int:pk>/", page_detail),
    path("sites/<int:site_pk>/builder/pages/<int:page_pk>/sections/", section_list),
    path(
        "sites/<int:site_pk>/builder/pages/<int:page_pk>/sections/reorder/",
        section_reorder,
    ),
    path("sites/<int:site_pk>/builder/sections/<int:pk>/", section_detail),
    path("sites/<int:site_pk>/builder/posts/", post_list),
    path("sites/<int:site_pk>/builder/posts/<int:pk>/", post_detail),
    path("sites/<int:site_pk>/builder/post-categories/", postcat_list),
    path("sites/<int:site_pk>/builder/post-categories/<int:pk>/", postcat_detail),
    path("sites/<int:site_pk>/builder/tags/", tag_list),
    path("sites/<int:site_pk>/builder/tags/<int:pk>/", tag_detail),
    path("sites/<int:site_pk>/builder/menus/", menu_list),
    path("sites/<int:site_pk>/builder/menus/<int:pk>/", menu_detail),
    path("sites/<int:site_pk>/builder/menus/<int:menu_pk>/items/", menuitem_list),
    path(
        "sites/<int:site_pk>/builder/menus/<int:menu_pk>/items/reorder/",
        menuitem_reorder,
    ),
    path(
        "sites/<int:site_pk>/builder/menus/<int:menu_pk>/items/<int:pk>/",
        menuitem_detail,
    ),
    path("sites/<int:site_pk>/builder/product-categories/", prodcat_list),
    path("sites/<int:site_pk>/builder/product-categories/<int:pk>/", prodcat_detail),
    path("sites/<int:site_pk>/builder/products/", product_list),
    path("sites/<int:site_pk>/builder/products/<int:pk>/", product_detail),
    path("sites/<int:site_pk>/builder/theme/", site_theme),
    path("sites/<int:site_pk>/builder/templates/", starter_list),
    path("sites/<int:site_pk>/builder/templates/apply/", starter_apply),
    path("sites/<int:site_pk>/builder/homepage/", starter_homepage),
    path("builder/themes/", theme_list),
    path("builder/themes/<int:pk>/", theme_detail),
]
