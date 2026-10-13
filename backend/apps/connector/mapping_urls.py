from django.urls import path

from .views import SelectorMappingViewSet

mapping_list = SelectorMappingViewSet.as_view({"get": "list", "post": "create"})
mapping_detail = SelectorMappingViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
mapping_reset = SelectorMappingViewSet.as_view({"post": "reset_defaults"})

# Admin mapping CRUD, mounted at /api/v1/sites/<site_pk>/mappings/.
urlpatterns = [
    path("", mapping_list, name="mapping-list"),
    path("reset-defaults/", mapping_reset, name="mapping-reset"),
    path("<int:pk>/", mapping_detail, name="mapping-detail"),
]
