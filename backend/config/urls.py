"""Root URLconf: admin, health, connector stub, API docs placeholder."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("api/admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("connector/", include("apps.connector.urls")),
]
