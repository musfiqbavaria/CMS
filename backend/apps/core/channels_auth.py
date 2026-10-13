"""Shared Channels auth: admin user from a JWT (query string or subprotocol)."""

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import UntypedToken


def admin_user_from_token_sync(raw: str):
    if not raw:
        return None
    try:
        token = UntypedToken(raw)
    except (InvalidToken, TokenError):
        return None
    try:
        user = get_user_model().objects.get(pk=token["user_id"])
    except Exception:
        return None
    if not user.is_active:
        return None
    if not (
        user.is_superuser or getattr(user, "role", None) in ("superadmin", "admin")
    ):
        return None
    return user
