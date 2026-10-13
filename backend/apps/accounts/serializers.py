"""Auth serializers: login, session, 2FA, password change/reset."""

from django.contrib.auth import get_user_model, password_validation
from rest_framework import serializers

User = get_user_model()


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class RefreshResponseSerializer(serializers.Serializer):
    access = serializers.CharField()


class TwoFactorChallengeSerializer(serializers.Serializer):
    two_fa_token = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=8)


class TwoFactorSetupConfirmSerializer(serializers.Serializer):
    code = serializers.CharField(min_length=6, max_length=8)


class TwoFactorDisableSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "is_2fa_enabled",
            "date_joined",
        ]
        read_only_fields = ["id", "username", "role", "is_2fa_enabled", "date_joined"]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_new_password(self, value):
        password_validation.validate_password(value, self.context["request"].user)
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_new_password(self, value):
        password_validation.validate_password(value)
        return value
