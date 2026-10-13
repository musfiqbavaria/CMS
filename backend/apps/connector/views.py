"""Public connector endpoints (no auth) + admin mapping CRUD."""

from pathlib import Path

from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.core.ssrf import UnsafeURLError, safe_fetch
from apps.sites.models import Site

from . import services
from .models import SelectorMapping

LOADER_JS = Path(__file__).resolve().parent / "static" / "connector" / "loader.js"


def cors(response):
    response["Access-Control-Allow-Origin"] = "*"
    return response


@csrf_exempt
@require_GET
def connector_ping(request):
    return cors(JsonResponse({"status": "ok", "service": "connector"}))


@csrf_exempt
@require_GET
def config_detail(request, site_key: str):
    """Published config with ETag revalidation. Short browser cache; Redis behind it."""
    site = services.public_site(site_key)
    if site is None:
        return cors(JsonResponse({"detail": "Not found."}, status=404))
    payload, etag = services.get_cached_payload(site)
    if request.headers.get("If-None-Match") == etag:
        resp = HttpResponse(status=304)
        resp["ETag"] = etag
        resp["Cache-Control"] = "public, max-age=0, must-revalidate"
        return cors(resp)
    resp = JsonResponse(payload)
    resp["ETag"] = etag
    resp["Cache-Control"] = "public, max-age=0, must-revalidate"
    return cors(resp)


@csrf_exempt
@require_GET
def loader_js(request):
    """The <script> snippet installed on the external site."""
    if not (request.GET.get("site") or "").strip():
        return cors(JsonResponse({"detail": "Missing ?site=SITE_KEY."}, status=400))
    try:
        body = LOADER_JS.read_bytes()
    except OSError:
        return cors(JsonResponse({"detail": "Loader unavailable."}, status=500))
    resp = HttpResponse(body, content_type="application/javascript")
    resp["Cache-Control"] = "public, max-age=3600"
    return cors(resp)


@csrf_exempt
@require_GET
def proxy_page(request, site_key: str):
    """Reverse-proxy demo: origin HTML + <base> fix + loader injection.

    Production use means pointing the domain's DNS at the CMS proxy (see the
    setup page); this endpoint proves the injection pipeline on any path.
    """
    site = services.public_site(site_key)
    if site is None:
        return cors(HttpResponse("Not found.", status=404, content_type="text/plain"))
    if site.integration_mode != Site.IntegrationModes.PROXY:
        return cors(
            HttpResponse(
                "Site is not in Reverse Proxy mode.",
                status=400,
                content_type="text/plain",
            )
        )
    if site.verification_status != Site.VerificationStatuses.VERIFIED:
        return cors(
            HttpResponse(
                "Site ownership is not verified.", status=403, content_type="text/plain"
            )
        )
    path = request.GET.get("path", "/")
    if not path.startswith("/") or "://" in path:
        return cors(
            HttpResponse("Invalid path.", status=400, content_type="text/plain")
        )
    try:
        result = safe_fetch(f"https://{site.domain}{path}")
    except UnsafeURLError as exc:
        return cors(
            HttpResponse(
                f"Upstream refused: {exc}", status=502, content_type="text/plain"
            )
        )
    except Exception as exc:
        return cors(
            HttpResponse(
                f"Upstream failed: {exc}", status=502, content_type="text/plain"
            )
        )
    html = result.text
    if "<head" not in html.lower():
        return cors(
            HttpResponse(
                "Upstream did not return HTML.", status=502, content_type="text/plain"
            )
        )
    loader_tag = (
        f'<script src="/connector/v1/loader.js?site={site.site_key}" async></script>'
    )
    base_tag = f'<base href="https://{site.domain}/">'
    lower = html.lower()
    head_idx = lower.find("<head")
    head_end = html.find(">", head_idx) + 1
    html = html[:head_end] + base_tag + html[head_end:]
    body_idx = html.lower().find("</head>")
    html = (
        html[:body_idx] + loader_tag + html[body_idx:]
        if body_idx != -1
        else html + loader_tag
    )
    resp = HttpResponse(html, content_type="text/html")
    resp["Cache-Control"] = "public, max-age=0, must-revalidate"
    return cors(resp)


class MappingSerializer(serializers.ModelSerializer):
    key_label = serializers.CharField(source="get_key_display", read_only=True)

    class Meta:
        model = SelectorMapping
        fields = [
            "id",
            "site",
            "key",
            "key_label",
            "selector",
            "enabled",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "site", "key_label", "created_at", "updated_at"]

    def validate_selector(self, value):
        if not value.strip():
            raise serializers.ValidationError("Selector is required.")
        return value.strip()


class SelectorMappingViewSet(GenericViewSet):
    """Admin CRUD for a site's selector mappings. Changes purge the config cache."""

    serializer_class = MappingSerializer
    queryset = SelectorMapping.objects.select_related("site").all()

    def get_site(self) -> Site:
        from django.shortcuts import get_object_or_404

        return get_object_or_404(Site, pk=self.kwargs["site_pk"])

    def purged(self, site, data, code=200):
        from django.db import transaction

        from .tasks import purge_connector_cache

        transaction.on_commit(lambda: purge_connector_cache.delay(site.pk))
        return Response(data, status=code)

    def list(self, request, site_pk=None):
        site = self.get_site()
        qs = site.mappings.all()
        return Response(MappingSerializer(qs, many=True).data)

    def create(self, request, site_pk=None):
        from django.db import IntegrityError, transaction

        site = self.get_site()
        serializer = MappingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if site.mappings.filter(key=serializer.validated_data["key"]).exists():
            return Response({"key": ["This mapping already exists."]}, status=400)
        try:
            with transaction.atomic():
                mapping = site.mappings.create(
                    key=serializer.validated_data["key"],
                    selector=serializer.validated_data["selector"],
                    enabled=serializer.validated_data.get("enabled", True),
                )
        except IntegrityError:
            # Lost a race with another request; the savepoint keeps us safe.
            return Response({"key": ["This mapping already exists."]}, status=400)
        return self.purged(site, MappingSerializer(mapping).data, 201)

    def retrieve(self, request, site_pk=None, pk=None):
        mapping = self.get_site().mappings.get(pk=pk)
        return Response(MappingSerializer(mapping).data)

    def partial_update(self, request, site_pk=None, pk=None):
        site = self.get_site()
        mapping = site.mappings.get(pk=pk)
        serializer = MappingSerializer(mapping, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return self.purged(site, serializer.data)

    def destroy(self, request, site_pk=None, pk=None):
        from django.shortcuts import get_object_or_404

        site = self.get_site()
        mapping = get_object_or_404(site.mappings, pk=pk)
        mapping.delete()
        return self.purged(site, {}, 204)

    def reset_defaults(self, request, site_pk=None):
        site = self.get_site()
        site.mappings.all().delete()
        services.ensure_default_mappings(site)
        return self.purged(site, MappingSerializer(site.mappings.all(), many=True).data)
