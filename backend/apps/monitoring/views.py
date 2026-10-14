"""Monitoring API: check history, per-site summary, notifications."""

from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.sites.models import Site

from . import services
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


class CheckRunView(APIView):
    """Run one check right now (uptime/ssl/connector) instead of waiting
    for the Beat schedule. Synchronous; DNS fetch bounded by SSRF limits."""

    @extend_schema(
        request={
            "type": "object",
            "properties": {
                "site": {"type": "integer"},
                "check_type": {
                    "type": "string",
                    "enum": ["uptime", "ssl", "connector"],
                },
                "host": {"type": "string"},
            },
            "required": ["site", "check_type"],
        },
        responses={200: HealthCheckSerializer},
    )
    def post(self, request):
        site = get_object_or_404(Site, pk=request.data.get("site"))
        check_type = request.data.get("check_type")
        runners = {
            HealthCheck.Types.UPTIME: services.check_uptime,
            HealthCheck.Types.SSL: services.check_ssl,
            HealthCheck.Types.CONNECTOR: services.check_connector,
        }
        run = runners.get(check_type)
        if run is None:
            return Response(
                {"detail": "check_type must be uptime, ssl or connector."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        kwargs = {}
        if check_type in (HealthCheck.Types.UPTIME, HealthCheck.Types.SSL):
            host = (request.data.get("host") or "").strip()
            if host and host not in services.monitored_hostnames(site):
                return Response(
                    {"detail": "Unknown hostname for this site."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            kwargs["host"] = host or None
        check = run(site, **kwargs)
        return Response(HealthCheckSerializer(check).data)


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
