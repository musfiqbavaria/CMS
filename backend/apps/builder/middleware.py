"""Resolve a built site from the Host header for public rendering."""

from django.conf import settings

from apps.sites.models import Site


class BuilderDomainMiddleware:
    """Sets request.built_site when Host matches an active built site's domain.

    Matching is case-insensitive. The platform apex itself never resolves to
    a site (it serves the admin SPA); every customer site — free subdomain
    or custom domain — is served from this same host.
    """

    CMS_HOSTS = {
        "localhost",
        "127.0.0.1",
        "backend",
        "daphne",
        "nginx",
        "frontend",
        "testserver",
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.built_site = None
        host = (request.get_host() or "").split(":")[0].strip().lower().rstrip(".")
        base = (getattr(settings, "PLATFORM_BASE_DOMAIN", "") or "").strip().lower()
        if host and host not in self.CMS_HOSTS and host != base:
            try:
                site = Site.objects.select_related("theme").get(
                    domain__iexact=host,
                    type=Site.Types.BUILT,
                    status=Site.Statuses.ACTIVE,
                )
            except Site.DoesNotExist:
                site = None
            request.built_site = site
        return self.get_response(request)
