# Multi-Site CMS Platform

Central admin-controlled CMS: connect existing sites by domain, build new sites
with a block builder, publish via connector script or reverse proxy, monitor health.

## Architecture (Phase 0)

```
Admin Browser -> NGINX (:8080 in dev) -> frontend (Vite :5173) | backend (Gunicorn :8000) | daphne (:8001)
backend/daphne/worker/beat -> PostgreSQL 16 (db:5432) + Redis 7 (redis:6379)
```

| Path | Target | Notes |
|---|---|---|
| `/` | frontend | SPA (dev: Vite HMR, prod: static `dist/`) |
| `/api/` | Gunicorn | DRF. Public in Phase 0: only `/api/health/`. Default-deny from Phase 1. |
| `/ws/` | Daphne | Channels. Echo at `ws/echo/` in Phase 0. |
| `/connector/` | Gunicorn | Stub 200 in Phase 0. Real public API in Phase 6. |
| `/static/`, `/media/` | backend (dev) / Nginx volumes (prod) | WhiteNoise enabled |

## Prerequisites

- Docker Engine + Docker Compose v2
- Ports free: `8080` (nginx), `5432`/`6379` only inside compose network (not published by default)

## Quick start (dev)

```powershell
Copy-Item .env.example .env
docker compose up --build
# or: make up-build
```

Open:

- App: http://localhost:8080/
- API health: http://localhost:8080/api/health/
- WS echo: `ws://localhost:8080/ws/echo/` (use `make ws-echo-test` or a WS client)
- Django admin: http://localhost:8080/api/admin/ (user from `.env` superuser vars)

## Authentication (Phase 1)

- Custom `User` model (`apps.accounts`): roles `superadmin` / `admin`
  (`editor` can be added later), TOTP 2FA fields, lockout counters.
- JWT: access token (15 min) in memory, rotating refresh token (7 days) in an
  httpOnly + `SameSite=Lax` cookie (`Secure` in prod). Rotation blacklists the old token.
- Lockout: 5 failed logins → HTTP 423 for 15 minutes (`LOGIN_MAX_ATTEMPTS` /
  `LOGIN_LOCKOUT_MINUTES`). Login also throttled to 10/min per IP.
- Optional TOTP 2FA: `GET/POST /api/v1/auth/2fa/setup/`, step-2 `POST /api/v1/auth/2fa/login/`.
- Password reset via email (console backend in dev): `POST /api/v1/auth/password-reset/`
  then `/api/v1/auth/password-reset/confirm/`. Reset page: `/reset-password`.
- Default-deny: every API requires auth + admin role except `/api/health/`,
  `/api/v1/auth/login|refresh|password-reset*`, `/api/v1/auth/2fa/login/`,
  `/connector/*`. API docs at `/api/docs/` are admin-only.
- Login UI at `/login`; all other pages redirect there when unauthenticated.

Note: Phase 1 switched `AUTH_USER_MODEL`, which required a one-time dev DB reset
(`docker compose down -v && docker compose up -d`). Not needed going forward.

## Commands (Makefile)
| Command | What it does |
|---|---|
| `make up` / `make up-build` / `make down` | start / rebuild / stop dev stack |
| `make logs` / `make ps` | follow logs / list services |
| `make migrate` / `make makemigrations` | run / create migrations in `backend` container |
| `make createsuperuser` | interactive superuser creation |
| `make test` | backend pytest (`backend` container) |
| `make lint` | flake8 + black --check + isort --check |
| `make celery-ping` | run `core.ping` via Celery worker and show result |
| `make health` | curl `/api/health/` through Nginx |
| `make shell` | `manage.py shell` in container |

On Windows without `make`, run the `docker compose ...` commands shown by
`make help` (each target echoes its compose command).

## Production (skeleton, Phase 0)

```powershell
Copy-Item .env.example .env
# set DJANGO_SECRET_KEY, DJANGO_DEBUG=False, DJANGO_SETTINGS_MODULE=config.settings.prod, strong POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml up --build
```

Prod Nginx image (`docker/nginx.Dockerfile`) builds the React `dist/` and serves it
as static files; `/static/` + `/media/` are served from named volumes populated by
`backend` collectstatic.

## Repo layout

```
/backend        Django 5 + DRF + Channels + Celery (config/, apps/core/, apps/<future>/)
/frontend       React 18 + TS + Vite + Tailwind + Router + Query + Zustand
/nginx          nginx.conf, conf.d/dev.conf, conf.d/prod.conf
/docker         backend.Dockerfile, frontend.Dockerfile, nginx.Dockerfile, entrypoint-backend.sh
docker-compose.yml, docker-compose.prod.yml, Makefile
.env.example, README.md, PROGRESS.md, .github/workflows/ci.yml
```

## Definition of Done (per phase)

Code runs in Docker, tests pass, lint passes, verification checklist passes,
README/PROGRESS updated, one commit per phase.
