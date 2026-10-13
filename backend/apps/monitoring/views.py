"""Monitoring API: check history, per-site summary, notifications."""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.sites.models import Site

from .models import HealthCheck, Notification
from .serializers import HealthCheckSerializer, NotificationSerializer


class HealthCheckViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = HealthCheck.objects.select_related("site").all()
    serializer_class = HealthCheckSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["site", "check_type", "status"]
    ordering_fields = ["checked_at"]
    ordering = ["-checked_at"]
    http_method_names = ["get", "head", "options"]


class MonitoringSummaryView(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Latest check per type for every active site. Not paginated: one row per site."""

    pagination_class = None
    http_method_names = ["get", "head", "options"]

    def list(self, request, *args, **kwargs):
        rows = []
        for site in Site.objects.filter(status=Site.Statuses.ACTIVE).order_by("name"):
            latest = {}
            for check_type, _ in HealthCheck.Types.choices:
                check = (
                    site.health_checks.filter(check_type=check_type)
                    .order_by("-checked_at")
                    .first()
                )
                latest[check_type] = (
                    {
                        "status": check.status,
                        "checked_at": check.checked_at,
                        "response_ms": check.response_ms,
                        "detail": check.detail,
                    }
                    if check
                    else None
                )
            states = [v["status"] for v in latest.values() if v]
            rows.append(
                {
                    "site": site.pk,
                    "name": site.name,
                    "domain": site.domain,
                    "type": site.type,
                    "checks": latest,
                    "overall": (
                        "fail" if "fail" in states else ("ok" if states else "unknown")
                    ),
                }
            )
        return Response(rows)


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Notification.objects.select_related("site").all()
    serializer_class = NotificationSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["site", "kind", "read"]
    ordering = ["-created_at"]
    http_method_names = ["get", "patch", "post", "head", "options"]

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        Notification.objects.filter(read=False).update(read=True)
        return Response(
            {"detail": "All notifications marked as read."}, status=status.HTTP_200_OK
        )
