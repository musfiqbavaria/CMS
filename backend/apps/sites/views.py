"""Thin Site ViewSet: filtering/search/ordering + delegation to services."""

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from . import services
from .models import Site
from .serializers import BulkActionSerializer, SiteSerializer


class SiteViewSet(viewsets.ModelViewSet):
    queryset = Site.objects.select_related("created_by").all()
    serializer_class = SiteSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["type", "status", "verification_status", "integration_mode"]
    search_fields = ["name", "domain"]
    ordering_fields = ["name", "domain", "created_at", "updated_at", "status"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def perform_create(self, serializer):
        data = serializer.validated_data
        site = services.create_site(
            actor=self.request.user,
            name=data["name"],
            domain=data["domain"],
            type=data.get("type", Site.Types.CONNECTED),
            integration_mode=data.get(
                "integration_mode", Site.IntegrationModes.CONNECTOR
            ),
            request=self.request,
        )
        serializer.instance = site

    def perform_update(self, serializer):
        site = self.get_object()
        updated = services.update_site(
            actor=self.request.user,
            site=site,
            request=self.request,
            **serializer.validated_data
        )
        serializer.instance = updated

    def perform_destroy(self, instance):
        services.delete_site(
            actor=self.request.user, site=instance, request=self.request
        )

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        site = services.set_site_status(
            actor=request.user, site=self.get_object(), active=True, request=request
        )
        return Response(SiteSerializer(site).data)

    @action(detail=True, methods=["post"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        site = services.set_site_status(
            actor=request.user, site=self.get_object(), active=False, request=request
        )
        return Response(SiteSerializer(site).data)

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        serializer = BulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            result = services.bulk_action(
                actor=request.user,
                site_ids=data["ids"],
                action=data["action"],
                request=request,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)
