# CMS Platform — PROGRESS

Living file: completed phases, key decisions, next steps.

## Completed

### Phase 0 — Foundation & Architecture Setup (done)
- Repo scaffold: `backend/`, `frontend/`, `nginx/`, `docker/`, compose files, Makefile, CI skeleton.
- Django settings split: `base` / `dev` / `prod`. ASGI + WSGI + Celery app wired.
- Services: db (Postgres 16), redis (Redis 7), backend (Gunicorn), daphne (Channels),
  celery_worker, celery_beat (DB scheduler), frontend (Vite dev), nginx (routing).
- Routing: `/` -> frontend, `/api/` -> Gunicorn, `/ws/` -> Daphne,
  `/connector/` -> Gunicorn (stub 200 in Phase 0, real API in Phase 6),
  `/static/` + `/media/` via WhiteNoise (dev) / Nginx volumes (prod).
- Health: `GET /api/health/` checks DB + Redis. WS echo at `ws/echo/`.
- Celery: `core.ping` task + Beat DB scheduler tables migrated.
- Entrypoint: wait-for-db, migrate, collectstatic, superuser-from-env.
- Non-root containers. Healthchecks + restart policies + named volumes.
- CI: backend lint/test, frontend lint/build.
- Verification fixes applied: corrected `AllowedHostsOriginValidator` import
  (`channels.security.websocket`, was wrongly imported from `channels.routing`
  which crashed Daphne); fixed `frontend/tsconfig.json` include (drop
  `vite.config.ts`, it belongs to `tsconfig.node.json`); black/isort formatting
  pass; stale `nginx` container recreated after losing network attachment.

## Decisions
- WhiteNoise in dev so Gunicorn can serve `/static/` behind Nginx without extra build step.
  Prod serves `/static/` + `/media/` directly from Nginx volumes.
- DRF default permission is `AllowAny` in Phase 0 so `/api/health/` is public.
  Phase 1 will switch default to `IsAuthenticated + IsAdminUser`.
- Dev Nginx proxies `/` to Vite dev server (hot reload). Prod Nginx serves the
  prebuilt React `dist/` (built inside the Nginx image).
- `celery_beat` uses `django_celery_beat` DB scheduler from day one.
- Makefile targets use `docker compose` (v2). Windows/PowerShell users can run the
  same `docker compose ...` commands directly.

## Next
- Phase 1 — Authentication & Access Control (custom User, JWT cookie rotation,
  lockout, 2FA, default-deny permissions, login UI, protected routes).
