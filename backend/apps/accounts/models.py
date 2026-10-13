"""Custom user model with roles and security fields (lockout, TOTP 2FA)."""

from django.contrib.auth.models import AbstractUser
from django.contrib.auth.models import UserManager as DjangoUserManager
from django.db import models
from django.utils import timezone


class UserManager(DjangoUserManager):
    """Ensure createsuperuser gets the superadmin role."""

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Roles.SUPERADMIN)
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    """Single admin user model. `editor` role can be added later (RBAC-ready)."""

    class Roles(models.TextChoices):
        SUPERADMIN = "superadmin", "Superadmin"
        ADMIN = "admin", "Admin"

    role = models.CharField(max_length=16, choices=Roles.choices, default=Roles.ADMIN)
    totp_secret = models.CharField(max_length=64, blank=True, default="")
    is_2fa_enabled = models.BooleanField(default=False)
    failed_login_attempts = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    ADMIN_ROLES = {Roles.SUPERADMIN, Roles.ADMIN}

    class Meta:
        indexes = [models.Index(fields=["username"]), models.Index(fields=["email"])]

    @property
    def is_locked(self) -> bool:
        return bool(self.locked_until and self.locked_until > timezone.now())

    @property
    def is_admin_role(self) -> bool:
        return self.is_superuser or self.role in self.ADMIN_ROLES

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"
