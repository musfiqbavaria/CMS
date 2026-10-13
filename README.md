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

## Admin shell & dashboard (Phase 2)
- `AdminLayout`: collapsible sidebar (desktop) + drawer (mobile), topbar with
  page search, dark/light mode, notifications bell, profile menu with sign-out.
- All sidebar routes exist: `/` Dashboard (live), the rest are clearly-marked
  stubs owned by their phase (`/websites` → 3, `/media` → 5, builder → 7, system → 8).
- Dashboard API `GET /api/v1/stats/overview/` (admin-only, cached 45 s): user
  aggregates, signups-by-day chart data, beat schedule count, recent users,
  system status (db/redis/celery worker ping).

## Websites (Phase 3)

- `Site` model: name, unique domain, auto `site_key` + verification token,
  type (connected/built), status (pending/active/inactive), integration mode,
  verification status. Duplicate domains rejected (case/format normalized).
- API `GET/POST /api/v1/sites/` (search, filter, ordering, pagination with
  `page_size`), `PATCH/DELETE /api/v1/sites/<id>/`, `POST .../activate|deactivate`,
  `POST /api/v1/sites/bulk/` (activate/deactivate/delete).
- Every write creates an `AuditLog` row (actor, action, site, before/after JSON);
  reads at `GET /api/v1/audit/logs/` (filter by site/actor/action).
- UI at `/websites` (and `/websites/new` opens the Add modal): table with search,
  type/status filters, sortable columns, pagination, row selection with bulk bar,
  Add/Edit/Delete/Activate modals, per-site History modal.

## Connect by domain (Phase 4)

- Every outbound fetch goes through `apps/core/ssrf.py`: http/https only, default
  ports, no credentials in URL, DNS resolution with public-IP enforcement
  (private/loopback/link-local rejected), per-hop re-validation on redirects,
  2 MB / 5-hop limits, direct connection (no proxy env).
- Creating a connected site queues `discover_site`: safe homepage fetch → title,
  description, favicon/logo, theme color stored as `Site.discovery` snapshot.
  `POST /api/v1/sites/<id>/discover/` re-runs it.
- Ownership: `POST /api/v1/sites/<id>/verify/` (`meta` HTML tag or `dns` TXT
  `cms-verify=TOKEN`) runs `verify_site_ownership`; success audits a `verified` row.
- Progress streams over WebSocket `ws/sites/<id>/progress/` (JWT `?token=`, admin
  only): started → fetching → completed/failed, verifying → verified/failed.
- UI at `/websites/:id/verify`: discovery snapshot, copy-paste meta snippet + DNS
  record, verify buttons, live progress feed. Row “Verify” action + auto-navigate
  after adding a connected site.

## Site editor (Phase 5)

- `SiteConfig` (draft + published JSON, published pointer) and immutable
  `ConfigVersion` (numbered, draft/published/archived). Draft seeded from discovery.
- `PATCH .../config/` autosaves silently (deep merge, no version noise);
  `POST .../save-draft/` snapshots a version; `POST .../publish/` (or a version id)
  archives the old live version and publishes; rollback republishes an old version.
  All version transitions are audited (`published` / `rolled_back`).
- `MediaAsset` library (per-site + shared): extension whitelist (no SVG), 10 MB cap,
  Pillow verification + dimensions. `GET/POST/DELETE /api/v1/media/`.
- Editor at `/websites/:id/edit`: 12 tabs (general → advanced), image picker with
  upload + crop (aspect, zoom), live iframe preview, autosave status, version
  history with publish/rollback, reset-to-published, route + browser unsaved guards.

## Connector & proxy (Phase 6)

- Public delivery under `/connector/`: `GET v1/config/<site_key>/` (published only,
  Redis-cached, ETag + `max-age=0, must-revalidate`, open CORS; custom CSS/JS only
  for verified sites; inactive/unknown keys 404), `GET v1/loader.js?site=`, and
  `GET v1/proxy/<site_key>/?path=` (proxy mode + verified only; injects
  `<base>` + loader tag into origin HTML).
- `loader.js` reads its own `?site=` (or `data-cms-site`), fetches config, and
  applies header/logo/favicon/hero/footer/theme through admin-editable
  `SelectorMapping` rows (`/websites/:id/mappings`, defaults seeded per site).
- Publish/rollback/mapping changes queue `purge_connector_cache` (post-commit).
- Setup page at `/websites/:id/setup`: copy-paste snippet, per-mode steps,
  proxy limitations, update-flow explanation.

## Website builder (Phase 7)

- Models: Theme (2 seeded builtins), Page/Section (10 types), Post + categories/tags,
  Menu/MenuItem, Product (+categories, variants, stock). Slugs auto-generated per site.
- Admin API under `/api/v1/sites/<id>/builder/` (built sites only): pages, sections
  (+reorder), posts/taxonomy, menus/items (+reorder), products/categories, themes,
  theme assignment. Media library page backed by the Phase 5 upload API.
- Public SSR renderer with Host-header routing (`BuilderDomainMiddleware` +
  Nginx host map): `/`, `/<slug>/`, `/blog/<slug>/`, `/shop/<slug>/`,
  `/sitemap.xml`, `/robots.txt`. Sitemap warming via `generate_sitemap` task.
- Builder UI: site picker, pages + per-page section editor (typed fields, HTML5
  drag reorder, enable toggles), posts, menus, themes gallery + assign, products
  with variants/stock, cross-page sections list.

## Monitoring, notifications & audit (Phase 8)

- `HealthCheck` history (uptime/SSL/connector) + `Notification` inbox with a live
  WebSocket (`ws/notifications/`, JWT-gated). Failures notify once per transition
  (no spam); recoveries notify too. Bell badge updates in real time.
- Beat schedules in the DB (migration): uptime 5 min, SSL/connector/sitemap/
  backup/cleanup daily. Backups are dumpdata JSON in `/vol/backups` (keep 7);
  cleanup trims versions (keep 20, never the published one) + old checks.
- Monitoring page (per-site status + history), full Audit Logs page (site/action/
  actor/search filters + pagination), Users & Roles page (create, role, active,
  delete with self/last-superadmin guards), Settings page (profile, password,
  TOTP 2FA setup/disable).

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
