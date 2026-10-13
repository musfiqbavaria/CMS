"""Read-only audit API. Writes happen only via audit.services from domain services."""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, viewsets

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    queryset = AuditLog.objects.select_related("actor", "site").all()
    serializer_class = AuditLogSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["site", "actor", "action", "model"]
    search_fields = ["site_display", "object_id"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]
    http_method_names = ["get", "head", "options"]
