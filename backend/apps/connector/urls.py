"""Connector stub (Phase 0): proves Nginx -> Gunicorn routing for /connector/."""

from django.http import JsonResponse
from django.urls import path


def connector_ping(request):
    return JsonResponse({"status": "ok", "service": "connector", "phase": 0})


urlpatterns = [
    path("v1/ping/", connector_ping, name="connector-ping"),
]
