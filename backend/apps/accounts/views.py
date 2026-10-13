"""Thin auth views. All state changes go through services; cookies carry refresh."""

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from . import services
from .serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RefreshResponseSerializer,
    TwoFactorChallengeSerializer,
    TwoFactorDisableSerializer,
    TwoFactorSetupConfirmSerializer,
    UserSerializer,
)
from .throttles import LoginRateThrottle

User = get_user_model()

REFRESH_COOKIE = "refresh_token"


def refresh_cookie_kwargs():
    lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    return {
        "key": REFRESH_COOKIE,
        "httponly": True,
        "secure": not settings.DEBUG,
        "samesite": "Lax",
        "path": "/",
        "max_age": int(lifetime.total_seconds()),
    }


def token_pair(user):
    refresh = RefreshToken.for_user(user)
    return refresh, str(refresh.access_token)


def attach_refresh_cookie(response, refresh) -> None:
    kwargs = refresh_cookie_kwargs()
    response.set_cookie(value=str(refresh), **kwargs)


def session_response(user, status_code=status.HTTP_200_OK):
    refresh, access = token_pair(user)
    response = Response(
        {"access": access, "requires_2fa": False, "user": UserSerializer(user).data},
        status=status_code,
    )
    attach_refresh_cookie(response, refresh)
    return response


def locked_response():
    return Response(
        {
            "detail": "Account temporarily locked after too many failed attempts. Try again later."
        },
        status=status.HTTP_423_LOCKED,
    )


class LoginView(APIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"]
        password = serializer.validated_data["password"]

        try:
            candidate = User.objects.get(username=username)
        except User.DoesNotExist:
            # Generic error: never reveal whether the username exists.
            return Response(
                {"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED
            )
        if candidate.is_locked:
            return locked_response()

        user = authenticate(request, username=username, password=password)
        if user is None or not user.is_active:
            services.record_failed_login(candidate)
            candidate.refresh_from_db()
            if candidate.is_locked:
                return locked_response()
            return Response(
                {"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED
            )
        if not user.is_admin_role:
            return Response(
                {"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN
            )

        services.reset_login_attempts(user)
        if user.is_2fa_enabled:
            return Response(
                {
                    "requires_2fa": True,
                    "two_fa_token": services.issue_two_fa_token(user),
                },
                status=status.HTTP_202_ACCEPTED,
            )
        return session_response(user)


class TwoFactorLoginView(APIView):
    serializer_class = TwoFactorChallengeSerializer
    """Step 2 of login for 2FA-enabled accounts. Also rate limited."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = TwoFactorChallengeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uid = services.consume_two_fa_token(serializer.validated_data["two_fa_token"])
        try:
            user = User.objects.get(pk=uid) if uid else None
        except User.DoesNotExist:
            user = None
        if user is None or not user.is_active or not user.is_2fa_enabled:
            return Response({"detail": "Invalid or expired 2FA session."}, status=401)
        if user.is_locked:
            return locked_response()
        if not services.verify_totp(
            user.totp_secret, serializer.validated_data["code"]
        ):
            services.record_failed_login(user)
            return Response({"detail": "Invalid two-factor code."}, status=401)
        services.reset_login_attempts(user)
        return session_response(user)


class RefreshView(APIView):
    serializer_class = RefreshResponseSerializer
    """Rotate the refresh token from the httpOnly cookie (access stays in memory)."""

    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(REFRESH_COOKIE)
        if not raw:
            return Response({"detail": "Missing refresh token."}, status=401)
        try:
            old = RefreshToken(raw)
            user = User.objects.get(pk=old["user_id"])
        except (TokenError, InvalidToken, User.DoesNotExist):
            return Response({"detail": "Invalid or expired refresh token."}, status=401)
        if not user.is_active:
            return Response({"detail": "Account disabled."}, status=401)
        refresh, access = token_pair(user)
        try:
            old.blacklist()
        except (TokenError, AttributeError):
            pass  # already blacklisted/unknown: still refuse reuse below via rotation
        response = Response({"access": access})
        attach_refresh_cookie(response, refresh)
        return response


class LogoutView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        raw = request.COOKIES.get(REFRESH_COOKIE)
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except (TokenError, AttributeError):
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(REFRESH_COOKIE, path="/")
        return response


class MeView(APIView):
    serializer_class = UserSerializer

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    serializer_class = ChangePasswordSerializer

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response({"detail": "Current password is incorrect."}, status=400)
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password changed."})


class TwoFactorSetupView(APIView):
    serializer_class = TwoFactorSetupConfirmSerializer
    """GET: provisioning details (generates a secret until confirmed).
    POST {code}: verify the code and enable 2FA."""

    def get(self, request):
        user = request.user
        if user.is_2fa_enabled:
            return Response({"enabled": True})
        if not user.totp_secret:
            user.totp_secret = services.new_totp_secret()
            user.save(update_fields=["totp_secret"])
        return Response(
            {
                "enabled": False,
                "secret": user.totp_secret,
                "otpauth_url": services.provisioning_uri(user, user.totp_secret),
            }
        )

    def post(self, request):
        serializer = TwoFactorSetupConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.totp_secret or not services.verify_totp(
            user.totp_secret, serializer.validated_data["code"]
        ):
            return Response({"detail": "Invalid code."}, status=400)
        user.is_2fa_enabled = True
        user.save(update_fields=["is_2fa_enabled"])
        return Response({"enabled": True})


class TwoFactorDisableView(APIView):
    serializer_class = TwoFactorDisableSerializer

    def post(self, request):
        serializer = TwoFactorDisableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["password"]):
            return Response({"detail": "Password is incorrect."}, status=400)
        user.is_2fa_enabled = False
        user.totp_secret = ""
        user.save(update_fields=["is_2fa_enabled", "totp_secret"])
        return Response({"enabled": False})


class PasswordResetRequestView(APIView):
    serializer_class = PasswordResetRequestSerializer
    """Always 200: never reveal whether an email is registered."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(
                email__iexact=serializer.validated_data["email"], is_active=True
            )
        except User.DoesNotExist:
            user = None
        if user is not None:
            services.send_password_reset_email(user)
        return Response(
            {"detail": "If the email is registered, a reset link was sent."}
        )


class PasswordResetConfirmView(APIView):
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = services.decode_password_reset_uid(data["uid"])
        if not services.check_password_reset_token(user, data["token"]):
            return Response({"detail": "Invalid or expired reset link."}, status=400)
        user.set_password(data["new_password"])
        user.failed_login_attempts = 0
        user.locked_until = None
        user.save(update_fields=["password", "failed_login_attempts", "locked_until"])
        return Response({"detail": "Password has been reset."})
