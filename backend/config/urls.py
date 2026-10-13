"""Root URLconf: admin, health, versioned auth API, connector, admin-only docs."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.permissions import IsAdminUser

urlpatterns = [
    path("api/admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.sites.urls")),
    path("api/v1/audit/", include("apps.audit.urls")),
    path("connector/", include("apps.connector.urls")),
    path(
        "api/schema/",
        SpectacularAPIView.as_view(permission_classes=[IsAdminUser]),
        name="schema",
    ),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="schema", permission_classes=[IsAdminUser]
        ),
        name="docs",
    ),
]
