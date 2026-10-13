from django.urls import path

from apps.sites.routing import websocket_urlpatterns as site_patterns

from .consumers import EchoConsumer

websocket_urlpatterns = [
    path("ws/echo/", EchoConsumer.as_asgi()),
    path("ws/", EchoConsumer.as_asgi()),
] + site_patterns
