"""Thin editor views: config draft/version endpoints + media library."""
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.sites.models import Site

from . import services
from .models import ConfigVersion, MediaAsset, SiteConfig
from .serializers import (
    ConfigVersionSerializer,
    MediaAssetSerializer,
    PublishSerializer,
    SaveDraftSerializer,
    SiteConfigSerializer,
)


def site_or_404(pk) -> Site:
    return get_object_or_404(Site, pk=pk)


class SiteConfigViewSet(viewsets.GenericViewSet):
    """Nested under a site: /api/v1/sites/<site_id>/config/..."""

    serializer_class = SiteConfigSerializer
    queryset = SiteConfig.objects.all()

    def get_site(self) -> Site:
        return site_or_404(self.kwargs["site_pk"])

    @action(detail=False, methods=["get"], url_path="")
    def current(self, request, site_pk=None):
        config = services.get_or_create_config(self.get_site())
        return Response(SiteConfigSerializer(config).data)

    @action(detail=False, methods=["patch"], url_path="draft")
    def patch_draft(self, request, site_pk=None):
        if not isinstance(request.data, dict):
            return Response({"detail": "Object with config sections expected."}, status=400)
        config = services.update_draft(actor=request.user, site=self.get_site(), patch=request.data)
        return Response(SiteConfigSerializer(config).data)

    @action(detail=False, methods=["post"], url_path="save-draft")
    def save_draft(self, request, site_pk=None):
        serializer = SaveDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = services.save_draft(
            actor=request.user, site=self.get_site(), note=serializer.validated_data.get("note", ""), request=request
        )
        return Response(ConfigVersionSerializer(version).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="publish")
    def publish(self, request, site_pk=None):
        serializer = PublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        version = services.publish(
            actor=request.user, site=self.get_site(),
            version_id=serializer.validated_data.get("version_id"), request=request,
        )
        return Response(ConfigVersionSerializer(version).data)

    @action(detail=False, methods=["post"], url_path="reset-draft")
    def reset_draft(self, request, site_pk=None):
        config = services.reset_draft_to_published(actor=request.user, site=self.get_site())
        return Response(SiteConfigSerializer(config).data)

    @action(detail=False, methods=["get"], url_path="versions")
    def versions(self, request, site_pk=None):
        qs = ConfigVersion.objects.filter(site=self.get_site()).select_related("author")
        page = self.paginate_queryset(qs)
        serializer = ConfigVersionSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path=r"versions/(?P<version_id>[0-9]+)/rollback")
    def rollback(self, request, site_pk=None, version_id=None):
        try:
            version = services.rollback(actor=request.user, site=self.get_site(), version_id=version_id, request=request)
        except ConfigVersion.DoesNotExist:
            return Response({"detail": "Version not found."}, status=404)
        return Response(ConfigVersionSerializer(version).data)


class MediaAssetViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    queryset = MediaAsset.objects.select_related("site", "uploaded_by").all()
    serializer_class = MediaAssetSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["site"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        site_id = self.request.query_params.get("site")
        if site_id:
            # Site's own assets plus the shared library.
            return qs.filter(Q(site_id=site_id) | Q(site__isnull=True))
        return qs

    def create(self, request, *args, **kwargs):
        upload = request.FILES.get("file")
        if upload is None:
            return Response({"detail": "No file uploaded."}, status=400)
        try:
            meta = services.validate_image_upload(upload)
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages}, status=400)
        site = None
        if request.data.get("site"):
            site = get_object_or_404(Site, pk=request.data["site"])
        asset = MediaAsset.objects.create(
            site=site,
            file=upload,
            alt=request.data.get("alt", "")[:255],
            width=meta["width"],
            height=meta["height"],
            size=meta["size"],
            uploaded_by=request.user,
        )
        return Response(MediaAssetSerializer(asset, context={"request": request}).data, status=201)

    def perform_destroy(self, instance):
        if instance.file:
            instance.file.delete(save=False)
        instance.delete()
