from django.urls import path
from rest_framework.routers import DefaultRouter

from .domain_views import SiteDomainViewSet
from .views import SiteViewSet

router = DefaultRouter()
router.register(r"sites", SiteViewSet, basename="site")

domain_list = SiteDomainViewSet.as_view({"get": "list", "post": "create"})
domain_detail = SiteDomainViewSet.as_view({"get": "retrieve", "delete": "destroy"})
domain_check = SiteDomainViewSet.as_view({"post": "check"})
domain_primary = SiteDomainViewSet.as_view({"post": "make_primary"})

urlpatterns = router.urls + [
    path("sites/<int:site_pk>/domains/", domain_list, name="site-domain-list"),
    path(
        "sites/<int:site_pk>/domains/<int:pk>/",
        domain_detail,
        name="site-domain-detail",
    ),
    path(
        "sites/<int:site_pk>/domains/<int:pk>/check/",
        domain_check,
        name="site-domain-check",
    ),
    path(
        "sites/<int:site_pk>/domains/<int:pk>/make-primary/",
        domain_primary,
        name="site-domain-primary",
    ),
]
