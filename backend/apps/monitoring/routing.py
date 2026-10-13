from django.urls import path

from apps.monitoring.consumers import NotificationConsumer

websocket_urlpatterns = [
    path("ws/notifications/", NotificationConsumer.as_asgi()),
]
