"""Root URLconf: admin, health, versioned auth API, connector, admin-only docs."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.builder import views_public
from apps.core.permissions import IsAdminUser

urlpatterns = [
    path("api/admin/", admin.site.urls),
    path("api/", include("apps.core.urls")),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/users/", include("apps.accounts.user_urls")),
    path("api/v1/", include("apps.sites.urls")),
    path("api/v1/", include("apps.content.urls")),
    path("api/v1/", include("apps.builder.urls")),
    path("api/v1/", include("apps.monitoring.urls")),
    path(
        "api/v1/sites/<int:site_pk>/mappings/", include("apps.connector.mapping_urls")
    ),
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
    # Public built-site renderer (Host header selects the site). Last on purpose:
    # more specific prefixes above always win.
    path("sitemap.xml", views_public.sitemap, name="builder-sitemap"),
    path("robots.txt", views_public.robots, name="builder-robots"),
    path("blog/<slug:slug>/", views_public.post_detail, name="builder-post"),
    path("shop/<slug:slug>/", views_public.product_detail, name="builder-product"),
    path("<slug:slug>/", views_public.page_detail, name="builder-page"),
    path("", views_public.home, name="builder-home"),
]

if settings.DEBUG:
    # Gunicorn does not serve uploads; dev Nginx proxies /media/ here.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
