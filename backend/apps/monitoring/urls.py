from django.urls import path

from .views import (
    CheckRunView,
    HealthCheckViewSet,
    MonitoringSummaryView,
    NotificationViewSet,
)

check_list = HealthCheckViewSet.as_view({"get": "list"})
check_detail = HealthCheckViewSet.as_view({"get": "retrieve"})
check_run = CheckRunView.as_view()
summary = MonitoringSummaryView.as_view({"get": "list"})
notif_list = NotificationViewSet.as_view({"get": "list"})
notif_detail = NotificationViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update"}
)
notif_mark_all = NotificationViewSet.as_view({"post": "mark_all_read"})

urlpatterns = [
    path("monitoring/checks/", check_list, name="healthcheck-list"),
    path("monitoring/checks/run/", check_run, name="healthcheck-run"),
    path("monitoring/checks/<int:pk>/", check_detail, name="healthcheck-detail"),
    path("monitoring/summary/", summary, name="monitoring-summary"),
    path("monitoring/notifications/", notif_list, name="notification-list"),
    path(
        "monitoring/notifications/mark-all-read/",
        notif_mark_all,
        name="notification-mark-all",
    ),
    path(
        "monitoring/notifications/<int:pk>/", notif_detail, name="notification-detail"
    ),
]
