"""Single writer for audit rows. Called by domain services, never by views directly."""

from .models import AuditLog


def log_action(
    *,
    actor,
    action: str,
    site=None,
    before: dict | None = None,
    after: dict | None = None,
    ip_address=None
) -> AuditLog:
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        model="site",
        object_id=str(site.pk) if site else "",
        site=site,
        site_display=site.domain if site else "",
        before=before or {},
        after=after or {},
        ip_address=ip_address,
    )


def client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")
