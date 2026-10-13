"""Phase 1 auth tests: gates, lockout, rotation, 2FA, password reset."""

from datetime import timedelta

import pyotp
import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

LOGIN_URL = "/api/v1/auth/login/"
REFRESH_URL = "/api/v1/auth/refresh/"
LOGOUT_URL = "/api/v1/auth/logout/"
ME_URL = "/api/v1/auth/me/"
SETUP_URL = "/api/v1/auth/2fa/setup/"
CHALLENGE_URL = "/api/v1/auth/2fa/login/"
RESET_URL = "/api/v1/auth/password-reset/"
CONFIRM_URL = "/api/v1/auth/password-reset/confirm/"


@pytest.fixture(autouse=True)
def _clear_cache():
    """Isolate rate-limit counters (and any cache) between tests."""
    from django.core.cache import cache

    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="admin1", email="admin1@example.com", password="StrongPass123!"
    )


def auth_client(client, access):
    client.defaults["HTTP_AUTHORIZATION"] = f"Bearer {access}"
    return client


def test_login_success_sets_cookie_and_returns_access(client, user):
    resp = client.post(LOGIN_URL, {"username": "admin1", "password": "StrongPass123!"})
    assert resp.status_code == 200
    assert resp.json()["access"]
    assert resp.json()["user"]["username"] == "admin1"
    assert "refresh_token" in resp.cookies
    assert resp.cookies["refresh_token"]["httponly"]


def test_me_requires_auth(client, user):
    assert client.get(ME_URL).status_code == 401
    resp = client.post(LOGIN_URL, {"username": "admin1", "password": "StrongPass123!"})
    auth_client(client, resp.json()["access"])
    me = client.get(ME_URL)
    assert me.status_code == 200
    assert me.json()["role"] == "admin"


def test_health_still_public(client):
    assert client.get("/api/health/").status_code in (200, 503)


def test_docs_require_admin(client):
    assert client.get("/api/docs/").status_code == 401


def test_lockout_after_max_attempts(client, user, settings):
    settings.LOGIN_MAX_ATTEMPTS = 5
    for _ in range(4):
        assert (
            client.post(
                LOGIN_URL, {"username": "admin1", "password": "wrong"}
            ).status_code
            == 401
        )
    # The 5th failure trips the lock immediately.
    assert (
        client.post(LOGIN_URL, {"username": "admin1", "password": "wrong"}).status_code
        == 423
    )
    # Correct password is also rejected while locked.
    resp = client.post(LOGIN_URL, {"username": "admin1", "password": "StrongPass123!"})
    assert resp.status_code == 423
    # After the lock expires, login works again.
    user.refresh_from_db()
    user.locked_until = timezone.now() - timedelta(seconds=1)
    user.save(update_fields=["locked_until"])
    assert (
        client.post(
            LOGIN_URL, {"username": "admin1", "password": "StrongPass123!"}
        ).status_code
        == 200
    )


def test_refresh_rotation_rejects_reuse(client, user):
    login = client.post(LOGIN_URL, {"username": "admin1", "password": "StrongPass123!"})
    old_cookie = login.cookies["refresh_token"].value
    first = client.post(REFRESH_URL)
    assert first.status_code == 200
    assert first.json()["access"]
    # Reusing the rotated-out refresh token must fail.
    client.cookies.load({"refresh_token": old_cookie})
    assert client.post(REFRESH_URL).status_code == 401


def test_logout_blacklists_refresh(client, user):
    login = client.post(LOGIN_URL, {"username": "admin1", "password": "StrongPass123!"})
    auth_client(client, login.json()["access"])
    cookie = login.cookies["refresh_token"].value
    assert client.post(LOGOUT_URL).status_code == 204
    client.cookies.load({"refresh_token": cookie})
    assert client.post(REFRESH_URL).status_code == 401


def test_two_factor_flow(client, user):
    login = client.post(LOGIN_URL, {"username": "admin1", "password": "StrongPass123!"})
    auth_client(client, login.json()["access"])
    setup = client.get(SETUP_URL).json()
    assert setup["secret"] and setup["otpauth_url"].startswith("otpauth://")
    code = pyotp.TOTP(setup["secret"]).now()
    assert client.post(SETUP_URL, {"code": code}).status_code == 200

    anon = client.__class__()
    step1 = anon.post(LOGIN_URL, {"username": "admin1", "password": "StrongPass123!"})
    assert step1.status_code == 202
    assert step1.json()["requires_2fa"] is True
    code2 = pyotp.TOTP(setup["secret"]).now()
    step2 = anon.post(
        CHALLENGE_URL, {"two_fa_token": step1.json()["two_fa_token"], "code": code2}
    )
    assert step2.status_code == 200
    assert step2.json()["access"]


def test_two_factor_wrong_code_rejected(client, user):
    user.totp_secret = pyotp.random_base32()
    user.is_2fa_enabled = True
    user.save()
    step1 = client.post(LOGIN_URL, {"username": "admin1", "password": "StrongPass123!"})
    bad = client.post(
        CHALLENGE_URL, {"two_fa_token": step1.json()["two_fa_token"], "code": "000000"}
    )
    assert bad.status_code == 401


def test_password_reset_flow(client, user, settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    assert client.post(RESET_URL, {"email": "admin1@example.com"}).status_code == 200
    # Unknown emails get the same response (no enumeration).
    assert client.post(RESET_URL, {"email": "nobody@example.com"}).status_code == 200

    from django.core import mail

    assert len(mail.outbox) == 1
    body = mail.outbox[0].body
    uid = body.split("uid=")[1].split("&")[0]
    token = body.split("token=")[1].split()[0]
    confirm = client.post(
        CONFIRM_URL, {"uid": uid, "token": token, "new_password": "BrandNew123!@"}
    )
    assert confirm.status_code == 200
    assert (
        client.post(
            LOGIN_URL, {"username": "admin1", "password": "BrandNew123!@"}
        ).status_code
        == 200
    )


def test_password_reset_bad_token_rejected(client, user):
    resp = client.post(
        CONFIRM_URL,
        {"uid": "MQ", "token": "bad-token", "new_password": "BrandNew123!@"},
    )
    assert resp.status_code == 400
