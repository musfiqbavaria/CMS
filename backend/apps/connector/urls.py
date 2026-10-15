from django.urls import path

from .views import config_detail, connector_ping, loader_js, preview_page, proxy_page

# Public delivery, mounted at /connector/ (open CORS, cached).
urlpatterns = [
    path("v1/ping/", connector_ping, name="connector-ping"),
    path("v1/loader.js", loader_js, name="connector-loader"),
    path("v1/config/<str:site_key>/", config_detail, name="connector-config"),
    path("v1/proxy/<str:site_key>/", proxy_page, name="connector-proxy"),
    path("v1/preview/<str:site_key>/", preview_page, name="connector-preview"),
]
