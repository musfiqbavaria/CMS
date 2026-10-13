from django.urls import include, path

from .views import MediaAssetViewSet, SiteConfigViewSet

media_list = MediaAssetViewSet.as_view({"get": "list", "post": "create"})
media_detail = MediaAssetViewSet.as_view({"get": "retrieve", "delete": "destroy"})

config_urls = [
    path("", SiteConfigViewSet.as_view({"get": "current", "patch": "patch_draft"})),
    path("save-draft/", SiteConfigViewSet.as_view({"post": "save_draft"})),
    path("publish/", SiteConfigViewSet.as_view({"post": "publish"})),
    path("reset-draft/", SiteConfigViewSet.as_view({"post": "reset_draft"})),
    path("versions/", SiteConfigViewSet.as_view({"get": "versions"})),
    path(
        "versions/<int:version_id>/rollback/",
        SiteConfigViewSet.as_view({"post": "rollback"}),
    ),
]

urlpatterns = [
    path("media/", media_list, name="media-list"),
    path("media/<int:pk>/", media_detail, name="media-detail"),
    path("sites/<int:site_pk>/config/", include(config_urls)),
]
