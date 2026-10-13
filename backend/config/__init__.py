"""Django config package. Ensures Celery app loads with Django."""

from .celery import app as celery_app  # noqa: F401
