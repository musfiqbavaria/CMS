"""Monitoring API: check history, per-site summary, notifications."""

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import HealthCheck, Notification
from .serializers import HealthCheckSerializer, NotificationSerializer


class HealthCheckViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = HealthCheck.objects.select_related("site").all()
    serializer_class = HealthCheckSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["site", "check_type", "host", "status"]
    ordering_fields = ["checked_at"]
    ordering = ["-checked_at"]
    http_method_names = ["get", "head", "options"]


class MonitoringSummaryView(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Latest check per type for every active site. Not paginated: one row per site."""

    pagination_class = None
    http_method_names = ["get", "head", "options"]

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def list(self, request, *args, **kwargs):
        from .services import monitoring_summary

        return Response(monitoring_summary())


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
