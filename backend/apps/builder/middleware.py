"""Resolve a built site from the Host header for public rendering."""

from apps.sites.models import Site


class BuilderDomainMiddleware:
    """Sets request.built_site when Host matches an active built site's domain."""

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
        host = (request.get_host() or "").split(":")[0].strip().lower()
        if host and host not in self.CMS_HOSTS:
            try:
                site = Site.objects.select_related("theme").get(
                    domain=host, type=Site.Types.BUILT, status=Site.Statuses.ACTIVE
                )
            except Site.DoesNotExist:
                site = None
            request.built_site = site
        return self.get_response(request)
