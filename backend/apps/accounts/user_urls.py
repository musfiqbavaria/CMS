from django.urls import path

from .user_views import UserViewSet

urlpatterns = [
    path("", UserViewSet.as_view({"get": "list", "post": "create"}), name="user-list"),
    path(
        "<int:pk>/",
        UserViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="user-detail",
    ),
]
