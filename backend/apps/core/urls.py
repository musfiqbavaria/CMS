from django.urls import path

from .views import dashboard_overview_view, health_check

urlpatterns = [
    path("health/", health_check, name="health"),
    path("v1/stats/overview/", dashboard_overview_view, name="stats-overview"),
]
