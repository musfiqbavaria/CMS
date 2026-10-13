from django.urls import path

from .consumers import SiteProgressConsumer

websocket_urlpatterns = [
    path("ws/sites/<int:site_id>/progress/", SiteProgressConsumer.as_asgi()),
]
