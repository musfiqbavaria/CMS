from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = (
        "username",
        "email",
        "role",
        "is_2fa_enabled",
        "is_active",
        "is_staff",
    )
    list_filter = ("role", "is_2fa_enabled", "is_active")
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "CMS",
            {
                "fields": (
                    "role",
                    "is_2fa_enabled",
                    "failed_login_attempts",
                    "locked_until",
                )
            },
        ),
    )
