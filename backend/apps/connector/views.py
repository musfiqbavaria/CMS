"""Public connector endpoints (no auth) + admin mapping CRUD."""

import json
import re
from pathlib import Path

from django.http import HttpResponse, JsonResponse
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from apps.core.ssrf import UnsafeURLError, safe_fetch
from apps.sites.models import Site

from . import services
from .models import SelectorMapping

LOADER_JS = Path(__file__).resolve().parent / "static" / "connector" / "loader.js"
EDITOR_BRIDGE_JS = LOADER_JS.with_name("editor-bridge.js")

# Framing blockers some origins send (Django's XFrameOptionsMiddleware emits
# X-Frame-Options: DENY by default). Removed for editor previews only.
FRAME_BLOCK_META_RE = re.compile(
    r'<meta\s+[^>]*http-equiv\s*=\s*["\']?\s*'
    r"(content-security-policy|x-frame-options)"
    r'\s*["\']?[^>]*>',
    re.IGNORECASE,
)


def cors(response):
    response["Access-Control-Allow-Origin"] = "*"
    return response


@csrf_exempt
@require_GET
def connector_ping(request):
    return cors(JsonResponse({"status": "ok", "service": "connector"}))


@require_GET
def editor_bridge_js(request):
    try:
        body = EDITOR_BRIDGE_JS.read_bytes()
    except OSError:
        return HttpResponse(
            "Preview inspector unavailable.", status=503, content_type="text/plain"
        )
    response = HttpResponse(body, content_type="application/javascript")
    response["Cache-Control"] = "public, max-age=0, must-revalidate"
    return response


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
    # The public config keeps stable ETags. A fresh, short-lived report ticket
    # belongs to the loader request instead of the cached config body.
    from .delivery import issue_ticket

    site = Site.objects.filter(
        site_key=request.GET["site"].strip(),
        status=Site.Statuses.ACTIVE,
        type=Site.Types.CONNECTED,
        verification_status=Site.VerificationStatuses.VERIFIED,
    ).first()
    if site:
        bootstrap = (
            "(function(){var s=document.currentScript;"
            'if(s)s.setAttribute("data-cms-report-token",%s);})();\n'
            % json.dumps(issue_ticket(site))
        )
        body = bootstrap.encode() + body
    resp = HttpResponse(body, content_type="application/javascript")
    resp["Cache-Control"] = "no-store"
    return cors(resp)


@csrf_exempt
@require_POST
def delivery_report(request, site_key: str):
    """Public, bounded browser observations. No CMS credentials are accepted."""
    from .delivery import ReportSerializer, accept_report

    site = Site.objects.filter(
        site_key=site_key,
        type=Site.Types.CONNECTED,
        status=Site.Statuses.ACTIVE,
        verification_status=Site.VerificationStatuses.VERIFIED,
    ).first()
    if site is None:
        return cors(JsonResponse({"detail": "Not found."}, status=404))
    try:
        if (
            int(request.META.get("CONTENT_LENGTH") or 0) > 32768
            or len(request.body) > 32768
        ):
            return cors(JsonResponse({"detail": "Report exceeds 32 KB."}, status=413))
        serializer = ReportSerializer(data=json.loads(request.body))
        serializer.is_valid(raise_exception=True)
        created = accept_report(request, site, serializer.validated_data)
    except (ValueError, UnicodeDecodeError):
        return cors(JsonResponse({"detail": "Invalid JSON report."}, status=400))
    except APIException as exc:
        response = JsonResponse({"detail": exc.detail}, status=exc.status_code)
        if getattr(exc, "wait", None):
            response["Retry-After"] = str(int(exc.wait))
        return cors(response)
    response = JsonResponse({"accepted": created}, status=202)
    response["Cache-Control"] = "no-store"
    return cors(response)


class DeliveryStatusViewSet(GenericViewSet):
    """Private observations and diagnosis for an individual website."""

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def retrieve(self, request, site_pk=None):
        from django.shortcuts import get_object_or_404

        from .delivery import delivery_status

        site = get_object_or_404(
            Site.objects.select_related("config__published_version"), pk=site_pk
        )
        response = Response(delivery_status(site))
        response["Cache-Control"] = "no-store"
        return response


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


@csrf_exempt
@require_GET
@xframe_options_sameorigin
def preview_page(request, site_key: str):
    """Editor preview of a verified connected site, served through the CMS.

    Public layout only: origin scripts, forms, frames and API calls are blocked.
    CSP enforces an opaque sandbox, including when opened outside an iframe.
    The optional inspector can select settings, never write content or publish.
    """
    site = Site.objects.filter(site_key=site_key).first()
    if site is None:
        return cors(HttpResponse("Not found.", status=404, content_type="text/plain"))
    if site.type != Site.Types.CONNECTED:
        return cors(
            HttpResponse(
                "Preview is for connected sites.",
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
    channel = request.GET.get("edit_channel", "")
    if channel and not re.fullmatch(r"[a-zA-Z0-9_-]{16,128}", channel):
        return HttpResponse(
            "Invalid preview channel.", status=400, content_type="text/plain"
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
    from .editor_preview import inspector_tag, preview_nonce, preview_policy

    html = FRAME_BLOCK_META_RE.sub("", html)
    html = re.sub(
        r'<meta\b[^>]*http-equiv\s*=\s*["\']?refresh\b[^>]*>', "", html, flags=re.I
    )
    lower = html.lower()
    head_idx = lower.find("<head")
    head_end = html.find(">", head_idx) + 1
    # Resolve relative URLs like a browser would for this exact page: nested
    # pages keep their own directory, so assets and links stay correct.
    clean_path = path.split("?", 1)[0].split("#", 1)[0]
    if clean_path.endswith("/"):
        base_dir = clean_path
    else:
        base_dir = clean_path.rpartition("/")[0] + "/"
    base_tag = f'<base href="https://{site.domain}{base_dir}">'
    nonce = preview_nonce()
    inspector = str(inspector_tag(request, site, channel, nonce)) if channel else ""
    html = html[:head_end] + base_tag + inspector + html[head_end:]
    resp = HttpResponse(html, content_type="text/html")
    resp["Cache-Control"] = "no-store"
    resp["Content-Security-Policy"] = preview_policy(request, site, nonce)
    resp["Referrer-Policy"] = "no-referrer"
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

        transaction.on_commit(lambda: services.purge_site_cache(site))
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
