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

### Click-to-edit preview

In the website editor's **Split** or **Preview** view, leave **Click to edit**
enabled. Hover over a supported area to see its outline, then click it (or tab
to it and press Enter) to open and focus its existing editing controls. In-progress
form values are preserved. Selection never saves or publishes content by itself;
editing fields follows the existing draft autosave and explicit Publish workflow.

The draft canvas uses explicit edit markers. The verified original-site preview
uses the website's enabled selector mappings; missing or disabled mappings are
not guessed. Unsupported content is not arbitrary inline HTML editing. Empty
sections can still be added or edited using the section navigation.

Unmapped elements can be turned into **page text areas**: click one and choose
**Make this text editable** to create an area (`pages.blocks` — path, selector,
label, text) that keeps the page's own text. The area autosaves with the draft,
shows an inline editor strip while it is selected, and is listed under
**Advanced → Page text areas**. Text is applied as plain text (no HTML). On the
published website each area applies only on its own path, after the mappings.

Original-site previews are read-only, opaque-origin sandboxes. Website scripts,
forms, nested frames, and API calls are blocked; their static styles and images
can render. Script-rendered content may therefore be absent. Only the CMS preview
inspector runs, communicating through source-, origin-, channel-, and field-checked
messages. No bridge is installed into the original website, and its source files
are not modified. Do not remove the dedicated Nginx preview location: it preserves
the preview's nonce-based CSP instead of inheriting the admin SPA's CSP.

The preview also runs the **published connector** in preview mode, so it matches
what visitors see on the live site: configured content, site name, browser title,
favicon, theme and generated sections all apply. The preview tag is nonce-stamped
and skips delivery reports and user custom JavaScript; the website's own script
tags stay CSP-blocked, so preview traffic never counts as a website delivery.

## Connector & proxy (Phase 6)

- Public delivery under `/connector/`: `GET v1/config/<site_key>/` (published only,
  Redis-cached, ETag + `max-age=0, must-revalidate`, open CORS; custom CSS/JS only
  for verified sites; inactive/unknown keys 404), `GET v1/loader.js?site=`, and
  `GET v1/proxy/<site_key>/?path=` (proxy mode + verified only; injects
  `<base>` + loader tag into origin HTML).
- `loader.js` reads its own `?site=` (or `data-cms-site`), fetches config, and
  applies header/logo/favicon/hero/footer/theme through admin-editable
  `SelectorMapping` rows (`/websites/:id/mappings`, defaults seeded per site)
  plus path-scoped `pages.blocks` page text areas, which apply only on their own
  page and override mapping text there.
- Publish/rollback/mapping changes invalidate the connector cache directly after
  commit; delivery also checks the published-version and mapping revisions. A
  slow/unavailable Celery worker cannot leave an older configuration live.
- Setup page at `/websites/:id/setup`: copy-paste snippet, per-mode steps,
  proxy limitations, update-flow explanation.

### Connected-site publishing: local versus public

The CMS can remain local for development. Publishing saves a version in its
database; it does **not** upload HTML or change files on the connected website's
server. The installed loader must be able to reach this CMS to fetch that version.

- For fully local testing, run the target website locally too and install the
  `http://localhost:8080/connector/v1/loader.js?site=...` tag from Setup. Publish,
  then reload that website. Do not disable browser security to work around
  HTTPS/local-network restrictions on an externally hosted page.
- For public delivery later, deploy the CMS over HTTPS, set `CMS_PUBLIC_URL` to
  its public origin (no path), and install the updated tag on the connected site.
  `VITE_CMS_PUBLIC_URL` is a build-time fallback for older API versions. Setting
  either variable does not create hosting, DNS, certificates, or a tunnel.
- Configure `DJANGO_ALLOWED_HOSTS`, CSRF origins, and your TLS reverse proxy for
  that address. Add the CMS hostname to the production Nginx `$serve_spa` map so
  its root serves the admin SPA instead of the customer-site renderer. Do not
  route the connected site's ERP/login traffic through a new proxy without
  testing its authentication and form flows.

Publish now uses the latest working draft, including autosaves made after a
saved version. Rollback still selects the explicitly requested immutable snapshot.
The default browser title follows site-name edits; a deliberately authored SEO
title takes precedence. Header and Branding both use the same logo field.
Uploading an image to Media Library does not select it as the logo/favicon:
choose it in the editor and publish. Existing localhost upload URLs are delivered
relative to the loader's CMS origin so they remain portable after deployment.

The connector supports names/taglines, logo/favicon, title/meta/share-image tags,
header layout/sticky state/CTA, hero text/background/buttons/alignment/overlay,
navigation, footer links/copyright/social links, colors, typography, and verified
custom code. New migrations repair untouched legacy default selectors while
preserving custom selectors and disabled choices. Arbitrary pages still need
matching elements; stable hooks are preferable to theme-specific classes:

```html
<strong data-cms="site-name">Brand</strong>
<img data-cms="logo" alt="Brand">
<nav data-cms="navigation"></nav>
<h1 data-cms="hero-heading">Heading</h1>
<p data-cms="hero-subheading">Description</p>
<div data-cms="hero-buttons"></div>
<div data-cms="footer-columns"></div>
<div data-cms="social-links"></div>
```

Newsletter visibility controls an **existing** form (`data-cms="newsletter"`);
subscription handling remains with the website's provider. Browser-applied SEO
does not replace server-rendered metadata for crawlers/social-card services.
Custom CSS/JS must also be permitted by the connected website's CSP; the loader
preserves its installation script's nonce and does not bypass browser policies.

For diagnostics, inspect `window.__CMS_CONNECTOR__` in the connected page's
console: `state`, `version`, `applied`, `unmatched`, and `errors`. Setup links to
the public published-config endpoint. HTTP 404 means the key/site is unknown or
inactive; missing selectors are reported without preventing other fields from
updating. Configuration responses revalidate on each new page load; the loader
is not cached so each browser load receives its own reporting ticket.

### Publish status dashboard

Open **Publish status** from a connected website's action menu, editor, or Setup.
The dashboard compares the current published version and mapping revision with
the most recent website-browser observation. It polls every 10 seconds while
visible and shows applied fields, missing selectors, application errors, and
the latest 20 reports. Publishing alone never creates a success report.

- `GET /api/v1/sites/<id>/delivery/` requires a CMS admin session.
- The CMS-served loader issues a signed, site-scoped, 10-minute report ticket.
  `POST /connector/v1/reports/<site_key>/` accepts bounded reports only from
  the registered website, its verified aliases, or the CMS preview origin.
- CMS-origin previews are kept separate from website reports. Sandboxed previews
  with opaque origins cannot confirm website delivery. A browser report is not
  an independent audit, proof of image loading, or confirmation for every page.
- Replayed retained tickets are ignored. Reports are limited to 60 per minute and retained to
  a maximum of 200 per website. Query strings, fragments, cookies, full URLs,
  and browser identity are not recorded in report records; long path segments
  are redacted. Normal web-server request logging is separate.
- A report is recent for 15 minutes. No report means **waiting**, not success.
  Reload the actual website after publishing. CSP, browser local-network rules,
  and unreachable localhost can prevent either configuration or reporting.

This feature requires the `connector.0003_deliveryreport` database migration.
The existing website's source and installed script tag do not need changes if
they already point to this CMS's loader endpoint.

Dependency-free connector checks (Node 20+):

```powershell
node nginx/tests/proxy-headers.test.mjs
node nginx/tests/connector-loader.test.mjs
```

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

## Builder hardening (Phase 12)

- Starter templates (Business, Portfolio, Store): `GET
  .../builder/templates/` lists them, `POST .../templates/apply/`
  seeds published pages + sections + nav menu and sets the homepage.
  Refuses non-empty sites unless `force: true` (which replaces pages/menus).
  The Pages empty state offers the gallery.
- Explicit homepage: `Site.homepage` + `POST .../builder/homepage/` (page
  must be published on that site); `/` renders it first, still falling back
  to slug `home`. The homepage cannot be deleted while selected; Pages rows
  show a homepage badge + “Set as homepage”.
- Site publish bar on the Pages page: live status, theme, View-live link,
  Publish/Unpublish site (activation gate for public rendering).

## Builder organization (Phase 15)

- Sidebar groups the builder by workflow (Build vs Content) and `/builder`
  is a guided Overview hub: a 7-step checklist (template → theme → homepage
  → menu → published content → site live → custom domain) with deep links.
- Five starter templates (Business, Portfolio, Store, Restaurant, Blog);
  the Blog pack seeds a category plus sample posts.
- New sections start with editable sample content per type — replace, don't
  start blank.

## Hosted sites (Phase 10)

Built sites are hosted on this same platform, Google-Sites style. Each site
has one canonical public address (`Site.domain`), chosen at creation:

- **Free subdomain**: `<slug>.<PLATFORM_BASE_DOMAIN>` (e.g.
  `myshop.sites.example.com`). Reserved names (`www`, `api`, `admin`, …)
  and the bare base domain itself cannot be claimed.
- **Custom domain**: any domain you own (e.g. `acme-store.com`). Point its
  DNS at this server. Automated ownership proof (CNAME + TXT token) arrives
  in Phase 11; until then custom domains serve once pointed and activated.

How it works:

- `BuilderDomainMiddleware` resolves the request `Host` (case-insensitive)
  to an active built site; everything else serves the admin SPA. Nginx needs
  no per-site config (`server_name _` already catches every host).
- DNS: create a wildcard record `*.sites.example.com → <server IP>` for
  subdomains, plus `A`/`CNAME` records for each custom domain.
- Django: `DJANGO_ALLOWED_HOSTS` must list the base with a leading dot for
  subdomains (`example.com,.example.com`), plus every custom domain (or `*`
  is NOT recommended in prod).
- Local testing without DNS: `curl -H "Host: myshop.sites.example.com"
  http://localhost:8080/` or add entries to `/etc/hosts`.
- TLS: terminate at Nginx / load balancer. Use one wildcard cert for
  `*.base` now; per-custom-domain certs (or cert-manager/ACME) come with
  Phase 11 verification.
- Roadmap: Phase 11 adds multi-alias hostnames (subdomain AND custom domain
  on one site) + CNAME/TXT verification UI; Phase 12 hardens the builder
  (templates, publish flow); Phase 13 covers per-host TLS automation,
  cache keys, and monitoring per public URL.

## Custom domains on hosted sites (Phase 11)

A built site can now answer on several addresses at once: its free subdomain
plus any number of custom domains, all served from this platform.

- Manage at `/websites/:id/domains` (row action “Domains”): the primary
  (canonical) address plus every alias with kind/verification badges.
- Adding a custom domain returns copy-paste DNS records: a `CNAME` to
  `PLATFORM_INGRESS_HOST` for traffic, and a `TXT cms-verify=TOKEN` record
  for ownership. Managed subdomains are verified automatically.
- “Check verification” runs the DNS TXT lookup synchronously; unverified
  aliases never serve traffic (unknown-host 404). “Make primary” switches
  the canonical address (`Site.domain`, sitemap, absolute URLs) to a verified
  alias; the primary cannot be deleted.
- API: `GET/POST /api/v1/sites/<id>/domains/`,
  `GET/DELETE /api/v1/sites/<id>/domains/<alias>/`,
  `POST .../check/`, `POST .../make-primary/`. Every change is audited.
- TLS: still terminate at Nginx/LB — add each custom domain to your certs
  (per-host automation arrives in Phase 13).

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

Hardening notes (Phase 9):
- Use `DJANGO_DEBUG=False`, `DJANGO_SETTINGS_MODULE=config.settings.prod`, and
  strong secrets; TLS termination happens at Nginx.
- Browser security headers and HSTS are configured in `nginx/nginx.conf`; the
  frontend bundle is route-split for reload performance.
- Production health check: `curl http://<host>/api/health/` through Nginx.
- Consolidated scheduler handles uptime, SSL, connector, sitemap, backup, and
  cleanup jobs.

## Production TLS (Phase 13)

TLS terminates at Nginx / your load balancer; this repo serves port 80 by
default and `nginx/conf.d/prod-tls.conf.example` is the 443 template.

- Wildcard for free subdomains: issue once via DNS-01
  (`certbot ... -d 'example.com' -d '*.example.com'`), mount under
  `/etc/nginx/certs/`, reload Nginx.
- Each custom domain: HTTP-01 works through this same Nginx
  (`/.well-known/acme-challenge/` is served on port 80 by the example);
  add the hostname to `DJANGO_ALLOWED_HOSTS` and
  `DJANGO_CSRF_TRUSTED_ORIGINS` (`https://...`), then reload.
- Renewals: `certbot renew` + `nginx -s reload` on a timer. The monitoring
  SSL check now probes **every verified hostname** (14-day warning,
  per-host failure alerts), so an expiring or missing custom-domain cert
  pages you before users notice.
- Cache inventory (all host-safe): connector payloads keyed by `site_key`
  (content is host-independent), sitemaps keyed by site id with canonical
  absolute URLs, public HTML carries `Cache-Control: public, max-age=60`
  plus `Vary: Host` so shared caches key per hostname.

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
