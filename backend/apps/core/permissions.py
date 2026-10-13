"""Project-wide DRF permissions."""

from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """Allows only authenticated users with an admin role.

    Installed as a global default (with DRF's IsAuthenticated) from Phase 1,
    so every endpoint is deny-by-default; public endpoints opt out via AllowAny.
    """

    message = "Admin access required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_superuser", False):
            return True
        return getattr(user, "role", None) in ("superadmin", "admin")
