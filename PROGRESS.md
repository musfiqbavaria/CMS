# CMS Platform — PROGRESS

Living file: completed phases, key decisions, next steps.

## Completed

### Phase 10 - Hosted-site addressing foundation (done)
- `PLATFORM_BASE_DOMAIN` setting (+ frontend `VITE_PLATFORM_BASE_DOMAIN`):
  built sites are created as free `<slug>.base` subdomains or on custom
  domains, all served from this same host (Nginx `server_name _` +
  `BuilderDomainMiddleware`), Google-Sites style.
- New `apps/sites/hosting.py`: hostname normalization, managed/subdomain
  detection, reserved-name guard, public-hostname validation, subdomain
  allocation. `SiteSerializer` accepts write-only `subdomain`, exposes
  read-only `is_managed` + `public_url`; middleware matches hosts
  case-insensitively and never resolves the platform apex; sitemap cache
  keyed by site pk (survives domain changes).
- Add-website form offers Free-subdomain vs Custom-domain for built sites
  with live URL preview; site list rows link out via `public_url`.
- Tests: 8 new pytest + extended vitest schema cases. Docs: README
  “Hosted sites”, `.env.example` DNS/TLS/ALLOWED_HOSTS notes.

### Phase 12 - Builder hardening: templates + publish flow (done)
- Starter templates (Business/Portfolio/Store) with apply endpoint (empty
  sites only unless forced; replaces pages/menus, sets homepage); gallery in
  the Pages empty state.
- Explicit `Site.homepage` (+ migration) with set-homepage endpoint
  (published pages only); `/` renders it first; homepage delete-guarded;
  Pages rows show badge + action.
- Site publish bar (status, theme, View-live, Publish/Unpublish) on Pages.
- Tests: 5 new pytest (list/apply/guard/force/homepage/delete-guard); full
  suite + lint + build green; prod rebuild + smoke green.
- Next: Phase 13 per-host TLS automation, cache keys, monitoring per URL.

### Phase 11 - Multi-alias hostnames + custom-domain verification (done)
- `SiteDomain` model (+ migrations incl. backfill: every existing site keeps
  a primary verified alias mirroring its domain). One site answers on its
  free subdomain AND any number of custom domains.
- Services-only writes: add (managed auto-verified, custom pending),
  synchronous DNS TXT check (`cms-verify=TOKEN`, reuses Phase 4 lookup),
  make-primary (verified only; moves `Site.domain`, purges sitemap cache),
  delete (primary protected). All audited.
- Middleware serves verified aliases; unverified custom hosts stay dark.
  `PLATFORM_INGRESS_HOST` (defaults to base) advertised as the CNAME target.
- Domains page at `/websites/:id/domains` (row action for built sites):
  badges, copy-paste CNAME/TXT instructions, check/make-primary/delete.
- Tests: 7 new pytest (add/verify/fail/primary/delete/middleware) — full
  backend suite green; tsc/eslint/vitest clean; prod rebuild + smoke green.

### Phase 9 - Production Readiness (done)\n- Deploy check now clean: fixed missing DRF `retrieve` actions and schema hints so `manage.py check --deploy` has only SSL-redirect W008 (TLS at Nginx).\n- Security/headers: HSTS + browser security/CSP headers in Nginx; .env secrets ignored; `.env.example` documents auth/upload/retention knobs.\n- Performance: monitoring summary uses a single-pass bounded query (no N+1), cached 30s and invalidated on new check; public connector/admin paths unaffected.\n- Frontend bundle split with route/lazy loading (main bundle ~435 KB vs previous ~959 KB); Nginx serves immutable `/assets` chunks.\n- CI: Redis service + DBURL/env for monitoring socket tests; frontend lint/test/build added; paths run from `backend/`.\n- Prod routing: host-aware Nginx map (`$serve_spa`) restores customer-domain rendering while serving SPA on CMS host; prod RSA/IP stale-DNS mitigation retained.\n- Smoke: production Compose project builds and boots; `/api/health/` 200 through Nginx; backend 81 pytest + 14 vitest + lint/build green.\n\n### Phase 8 - Monitoring, Notifications & Audit (done)
- `HealthCheck` + `Notification` models/migrations; uptime/SSL/connector services
  with transition-only notifications; `ws/notifications/` socket + frontend hook
  feeding the bell; Beat DB schedules migration (6 jobs); dumpdata backups with
  retention; version/health retention cleanup; sitemap refresh fan-out.
- Users & Roles API (self/last-superadmin guards) + page; Audit Logs page with
  filters; Monitoring page with summary + history; Settings page (profile,
  password, 2FA setup/disable UI).
- Tests: 10 pytest (transitions, connector, socket push, users guards, beat
  schedules, cleanup, backup) + 1 vitest (notifications store).
  Full suite: 81 pytest, 14 vitest, lint + build clean.
- E2E: simulated down site → fail check + `site_down` row + summary `fail`;
  live WS push verified after transient Redis contention cleared.
- Real bug fixed: redis-py 8 defaults `socket_timeout` to 5 s, which killed every
  idle channel-layer poll in Daphne; channel layer now sets 60 s. Both WS hooks
  also reconnect with backoff.

### Phase 7 — Website Builder (done)
- Builder models/migrations (themes, pages/sections, posts/taxonomy, menus,
  products) + `Site.theme` FK. Built-site-only enforcement in serializers.
- Admin CRUD APIs with nested explicit routes, section/menu reorder endpoints.
- SSR renderer (10 section types, escaping, trusted-custom-html only) + Host-based
  public routing (middleware + Nginx map; localhost still serves the SPA).
- `generate_sitemap` task + sitemap/robots views (Redis-warmed).
- Builder UI: site picker, pages, drag-reorder section editor, posts, menus,
  themes, products, media library page.
- Tests: 9 pytest (gate, pages/sections/reorder, render on mapped domain,
  post+product flow, themes, sitemap/robots, task, menu reorder) + 2 vitest
  (catalog parity, reorder helper). Full suite: 71 pytest, 13 vitest, lint +
  build clean. E2E: published page + product rendered on mapped domain.

### Phase 6 — Connector Script & Reverse Proxy (done)
- `SelectorMapping` model/migration + admin CRUD (validation, unique per site/key,
  reset-defaults, savepoint-safe duplicates); defaults seeded on site create.
- Public config API (Redis cache + ETag/304 + CORS, verified-gated custom code),
  static `loader.js` (self-locating site key, mapping-driven DOM overrides),
  proxy demo view (`<base>` fix + loader injection, proxy-mode + verified gate).
- `purge_connector_cache` task queued post-commit on publish/rollback/mapping edits.
- Setup + Mappings pages, snippet util, SitesPage Setup action.
- Tests: 9 pytest (gating, payload, ETag, verified code, purge-on-publish,
  rollback freshness, loader, proxy, mappings) + 1 vitest (snippet).
  Full suite: 62 pytest, 11 vitest, lint + build clean.
- E2E: published config live; real loader.js applied to fixture HTML via jsdom
  (headline/logo/CTA/footer changed); rollback changed payload + ETag immediately.

### Phase 5 — Site Editor, Versions & Live Preview (done)
- `SiteConfig` + `ConfigVersion` + `MediaAsset` models/migrations; silent autosave,
  numbered drafts, publish-with-archive, rollback-as-republish, all audited.
- Upload validation (whitelist, size, Pillow verify); dev media serving via Django.
- Editor UI: 12 tabs, media picker with crop, srcDoc live preview, autosave +
  save/publish toolbar, version history, reset, unsaved guards (router + unload).
- Tests: 6 pytest (seed, draft/publish/rollback incl. audit, versions list,
  upload accept/reject ×3) + 3 vitest (dirty check, escaping, preview content).
  Full suite: 53 pytest, 10 vitest, lint + build clean. E2E draft→publish→
  rollback verified through Nginx with audit rows.

### Phase 4 — Connect by Domain (done)
- `apps/core/ssrf.py`: scheme/port/credential checks, DNS + public-IP enforcement,
  per-redirect-hop re-validation, size/hop limits, proxy-env bypass. 13 SSRF tests.
- `discover_site` task (auto-queued on connected-site create, retry-on-transient):
  title/description/favicon/logo/theme snapshot on `Site`; `discover` endpoint (202).
- `verify_site_ownership` task: meta-tag compare or apex TXT `cms-verify=TOKEN`
  lookup; success sets verified + audit row; `verify` endpoint (202).
- `SiteProgressConsumer` (`ws/sites/<id>/progress/`, JWT query auth, admin-only)
  with stage events; `useSiteProgress` hook; Verify page with copy snippets,
  per-method verify buttons, live feed; row Verify action.
- Tests: 11 connect tests (queue-on-create, parse, meta/DNS pos+neg, task store,
  endpoints, socket auth gate). Full suite: 47 pytest, 7 vitest, lint + build clean.
- E2E: real example.com discovery via worker (snapshot stored), private-IP site
  fails with non-public message, live negative meta-verify, WS stage stream.

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
- (none) - phases 0-9 complete; unit suites and prod boot verified.
