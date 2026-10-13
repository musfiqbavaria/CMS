"""Auth business logic: lockout, TOTP, tokens, password reset. Only services write."""

import pyotp
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

TWO_FA_SIGN_SALT = "accounts.2fa"
TWO_FA_TOKEN_MAX_AGE = 15 * 60


def max_login_attempts() -> int:
    return int(getattr(settings, "LOGIN_MAX_ATTEMPTS", 5))


def lockout_minutes() -> int:
    return int(getattr(settings, "LOGIN_LOCKOUT_MINUTES", 15))


def record_failed_login(user) -> None:
    """Increment the counter; lock the account once the threshold is reached."""
    user.failed_login_attempts += 1
    if user.failed_login_attempts >= max_login_attempts():
        user.locked_until = timezone.now() + timezone.timedelta(
            minutes=lockout_minutes()
        )
    user.save(update_fields=["failed_login_attempts", "locked_until"])


def reset_login_attempts(user) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    user.save(update_fields=["failed_login_attempts", "locked_until"])


def issue_two_fa_token(user) -> str:
    """Short-lived signed token proving step-1 (password) auth for 2FA step 2."""
    return signing.dumps({"uid": user.pk}, salt=TWO_FA_SIGN_SALT)


def consume_two_fa_token(token: str):
    """Return the user id embedded in a valid 2FA token, else None."""
    try:
        data = signing.loads(token, salt=TWO_FA_SIGN_SALT, max_age=TWO_FA_TOKEN_MAX_AGE)
    except signing.BadSignature:
        return None
    return data.get("uid")


def new_totp_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(user, secret: str) -> str:
    issuer = getattr(settings, "TOTP_ISSUER", "CMS Platform")
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=user.email or user.username, issuer_name=issuer
    )


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)


def make_password_reset_link(user, frontend_url: str) -> str:
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{frontend_url.rstrip('/')}/reset-password?uid={uid}&token={token}"


def decode_password_reset_uid(uid: str):
    from django.contrib.auth import get_user_model

    try:
        pk = urlsafe_base64_decode(uid).decode()
        return get_user_model().objects.get(pk=pk)
    except Exception:
        return None


def check_password_reset_token(user, token: str) -> bool:
    if user is None:
        return False
    return default_token_generator.check_token(user, token)


def send_password_reset_email(user) -> None:
    link = make_password_reset_link(
        user, getattr(settings, "FRONTEND_URL", "http://localhost:8080")
    )
    send_mail(
        subject="CMS password reset",
        message=(
            f"Hello {user.username},\n\n"
            f"Use the link below to set a new password (valid for one use):\n{link}\n\n"
            "If you did not request this, ignore this email."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
