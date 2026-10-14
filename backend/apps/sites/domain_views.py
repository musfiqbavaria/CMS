"""Thin SiteDomain ViewSet: multi-alias hostnames for built sites (Phase 11)."""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from . import services
from .models import Site, SiteDomain
from .serializers import SiteDomainCreateSerializer, SiteDomainSerializer


class SiteDomainViewSet(GenericViewSet):
    serializer_class = SiteDomainSerializer
    queryset = SiteDomain.objects.select_related("site").all()

    def get_site(self) -> Site:
        return get_object_or_404(Site, pk=self.kwargs["site_pk"])

    def get_alias(self) -> SiteDomain:
        return get_object_or_404(SiteDomain, pk=self.kwargs["pk"], site=self.get_site())

    def list(self, request, site_pk=None):
        aliases = self.get_site().domains.all()
        return Response(SiteDomainSerializer(aliases, many=True).data)

    def create(self, request, site_pk=None):
        form = SiteDomainCreateSerializer(data=request.data)
        form.is_valid(raise_exception=True)
        try:
            alias = services.add_site_domain(
                actor=request.user,
                site=self.get_site(),
                hostname=form.validated_data["hostname"],
                request=request,
            )
        except DjangoValidationError as exc:
            return Response(
                {"detail": exc.messages if hasattr(exc, "messages") else str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(SiteDomainSerializer(alias).data, status=201)

    def retrieve(self, request, site_pk=None, pk=None):
        return Response(SiteDomainSerializer(self.get_alias()).data)

    def destroy(self, request, site_pk=None, pk=None):
        try:
            result = services.remove_site_domain(
                actor=request.user,
                site=self.get_site(),
                alias=self.get_alias(),
                request=request,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)

    def check(self, request, site_pk=None, pk=None):
        alias = services.check_site_domain(
            actor=request.user, alias=self.get_alias(), request=request
        )
        return Response(SiteDomainSerializer(alias).data)

    def make_primary(self, request, site_pk=None, pk=None):
        try:
            site = services.set_primary_domain(
                actor=request.user,
                site=self.get_site(),
                alias=self.get_alias(),
                request=request,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        from .serializers import SiteSerializer

        return Response(SiteSerializer(site).data)
