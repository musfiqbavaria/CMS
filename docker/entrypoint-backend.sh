#!/bin/sh
set -e

# Wait for Postgres to accept connections before migrate/collectstatic.
echo "Waiting for database ${DB_HOST:-db}:${DB_PORT:-5432}..."
python - <<'PY'
import os, socket, time
host = os.environ.get("DB_HOST", "db")
port = int(os.environ.get("DB_PORT", "5432"))
for i in range(60):
    try:
        with socket.create_connection((host, port), timeout=2):
            print("database reachable")
            break
    except OSError as exc:
        print(f"db not ready ({exc}), retry {i+1}/60")
        time.sleep(2)
else:
    raise SystemExit("database never became reachable")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput || true

# Create superuser from env if provided and missing.
if [ -n "${DJANGO_SUPERUSER_USERNAME:-}" ] && [ -n "${DJANGO_SUPERUSER_PASSWORD:-}" ]; then
  python - <<'PY'
import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", os.environ.get("DJANGO_SETTINGS_MODULE", "config.settings.dev"))
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "")
password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")
if username and password and not User.objects.filter(username=username).exists():
    User.objects.create_superuser(username=username, email=email, password=password)
    print(f"created superuser {username}")
else:
    print("superuser already exists or vars missing, skipping")
PY
fi

exec "$@"
