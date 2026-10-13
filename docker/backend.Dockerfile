FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      libpq5 curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 appuser \
    && mkdir -p /vol/static /vol/media \
    && chown -R appuser:appuser /vol

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

COPY backend/ /app/
COPY docker/entrypoint-backend.sh /app-entrypoint.sh
RUN chmod +x /app-entrypoint.sh \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000
