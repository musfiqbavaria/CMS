# CMS Platform — PROGRESS

Living file: completed phases, key decisions, next steps.

## Completed

### Phase 3 — Websites Management (done)
- `Site` model + migration (unique domain/site_key, type/status/mode/verification,
  created_by, indexes). `AuditLog` model + migration (actor/action/site snapshot,
  before/after JSON, survives site deletion).
- Services-only writes (`sites/services.py` + `audit/services.py`); ViewSets stay thin.
  CRUD + activate/deactivate + bulk endpoints; read-only audit API with filters.
- Fixed two real bugs found by tests (bulk kwarg mismatch) and one by runtime
  (DRF 3.18 dropped `PAGE_SIZE_QUERY_PARAM` → new `apps/core/pagination.py`).
- Fixed Nginx stale-upstream-DNS outage (backend IP changed after restart):
  dev+prod confs now use Docker DNS resolver with variable proxy targets.
- Websites UI: search (debounced), filters, sorting, pagination, bulk bar,
  Add/Edit/Delete/Activate modals, History modal, empty/loading/error states.
- Tests: 9 pytest (CRUD, dup domain, audit before/after, delete retention, bulk,
  filters) + 3 vitest (badges, domain schema). Full suite: 24 pytest, 7 vitest,
  flake8/black/isort + eslint + build clean. E2E lifecycle verified via Nginx.

### Phase 2 — Admin Shell & Dashboard (done)
- `AdminLayout`: collapsible desktop sidebar, mobile drawer, topbar (page search,
  dark/light mode persisted, notifications bell with honest empty state, profile
  menu + sign-out). All menu routes exist; non-dashboard pages are marked stubs
  owned by Phases 3/5/7/8.
- Dashboard API `GET /api/v1/stats/overview/` (admin-only, 45 s cache): user
  aggregates, 14-day signup series, beat schedule count, recent users, live
  db/redis/celery-worker status. Dashboard page shows stat cards, recharts
  area chart, system status, recent-users table with skeletons/error/retry.
- Tests: 2 pytest stats tests (gate + live data), vitest Sidebar menu test +
  ui-store test (4 frontend tests total). flake8/black/isort + eslint +
  `tsc + vite build` clean.

### Phase 1 — Authentication & Access Control (done)
- Custom `User` (`accounts`): roles, TOTP secret/flag, lockout fields; migration `0001_initial`.
- JWT session: access in memory, rotating refresh in httpOnly cookie (`Secure` in prod),
  blacklist on rotation/logout (`token_blacklist` app migrated).
- Lockout after 5 bad passwords (423, 15 min, env-tunable) + `LoginRateThrottle` 10/min.
- TOTP 2FA: setup/confirm/disable + two-step login via 15-min signed token.
- Password reset via email (console backend dev): request (always 200) + confirm.
- Default-deny DRF permissions (`IsAuthenticated` + `IsAdminUser`); health/connector/auth
  endpoints explicitly public; `/api/docs/` + `/api/schema/` admin-only.
- Frontend: axios client with refresh interceptor, zustand auth store (memory-only token),
  `/login` (incl. 2FA step), `/reset-password`, `ProtectedRoute` gate, session bootstrap.
  Temporary landing page stands in for the Phase 2 admin shell (clearly marked).
- Tests: 11 pytest auth tests (gates, lockout, rotation-reuse, logout, 2FA, reset),
  2 vitest tests (ProtectedRoute). Backend flake8/black/isort + eslint + `tsc+vite build` clean.

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
- Phase 4 — Connect by Domain (URL normalize/validate, SSRF guard, discovery +
  verification tasks with WS progress, verification UI).
