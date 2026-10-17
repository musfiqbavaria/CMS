from django.urls import path

from .views import DeliveryStatusViewSet

urlpatterns = [
    path(
        "", DeliveryStatusViewSet.as_view({"get": "retrieve"}), name="delivery-status"
    ),
]
