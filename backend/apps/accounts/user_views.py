"""Admin user management. Self-protection: no self-demote/deactivate/delete."""

from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.response import Response

from .user_serializers import AdminUserSerializer, UserCreateSerializer

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("-date_joined")
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["role", "is_active", "is_2fa_enabled"]
    search_fields = ["username", "email"]
    ordering_fields = ["username", "date_joined", "last_login"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        return UserCreateSerializer if self.action == "create" else AdminUserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(AdminUserSerializer(user).data, status=201)

    def partial_update(self, request, *args, **kwargs):
        target = self.get_object()
        if target.pk == request.user.pk:
            new_role = request.data.get("role", target.role)
            wants_deactivate = request.data.get("is_active") is False
            if new_role != target.role or wants_deactivate:
                return Response(
                    {
                        "detail": "You cannot change your own role or deactivate yourself."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        target = self.get_object()
        if target.pk == request.user.pk:
            return Response(
                {"detail": "You cannot delete yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (
            target.role == User.Roles.SUPERADMIN
            and User.objects.filter(role=User.Roles.SUPERADMIN).count() <= 1
        ):
            return Response(
                {"detail": "Cannot delete the last superadmin."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)
