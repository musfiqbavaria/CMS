import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../../backend/apps/connector/static/connector/loader.js", import.meta.url), "utf8");

// A small DOM double for deterministic loader logic tests without a browser or
// dependencies. Real rendering/CSP/network policies still require browser E2E.
class Element {
  constructor(tag, attrs = {}, content = "") {
    this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.children = [];
    this.content = content; this.parentElement = null; this.hidden = false;
    this.style = { setProperty(name, value) { this[name] = String(value); } };
  }
  get firstChild() { return this.children[0] ?? null; }
  get textContent() { return this.content + this.children.map((child) => child.textContent).join(""); }
  set textContent(value) { this.content = String(value); this.children = []; }
  get className() { return this.attrs.class ?? ""; }
  set className(value) { this.attrs.class = value; }
  get src() { return this.attrs.src ?? ""; }
  set src(value) { this.attrs.src = value; }
  get href() { return this.attrs.href ?? ""; }
  set href(value) { this.attrs.href = value; }
  get rel() { return this.attrs.rel ?? ""; }
  set rel(value) { this.attrs.rel = value; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  insertBefore(child, reference) {
    child.parentElement = this; const index = this.children.indexOf(reference);
    this.children.splice(index < 0 ? this.children.length : index, 0, child); return child;
  }
  replaceChildren(...children) { this.content = ""; this.children = []; children.forEach((child) => this.appendChild(child)); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this); }
  cloneNode(deep) { const copy = new Element(this.tagName, this.attrs, this.content); if (deep) this.children.forEach((child) => copy.appendChild(child.cloneNode(true))); return copy; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) {
    if ((selector.match(/\[/g) ?? []).length !== (selector.match(/\]/g) ?? []).length) throw new SyntaxError("Invalid selector");
    const selectors = selector.split(",").map((part) => part.trim());
    const all = this.children.flatMap(function descend(child) { return [child, ...child.children.flatMap(descend)]; });
    return all.filter((node) => selectors.some((part) => matches(node, part)));
  }
}

function matchesSimple(node, token) {
  if (token === ":root") return node.tagName === "HTML";
  const attributes = [...token.matchAll(/\[([\w-]+)(?:(~=|=)"([^"]*)")?\]/g)];
  token = token.replace(/\[[^\]]*\]/g, "");
  for (const [, name, operator, value] of attributes) {
    const actual = node.getAttribute(name);
    if (actual === null || (operator === "=" && actual !== value) || (operator === "~=" && !actual.split(/\s+/).includes(value))) return false;
  }
  const tag = /^[\w-]+/.exec(token)?.[0];
  if (tag && node.tagName !== tag.toUpperCase()) return false;
  for (const [, name] of token.matchAll(/\.([\w-]+)/g)) if (!node.className.split(/\s+/).includes(name)) return false;
  if (token.includes(":first-child") && node.parentElement?.children[0] !== node) return false;
  if (token.includes(":last-of-type") && node.parentElement?.children.filter((child) => child.tagName === node.tagName).at(-1) !== node) return false;
  return true;
}

function matches(node, selector) {
  const tokens = selector.replace(/>/g, " > ").match(/(?:\[[^\]]*\]|[^\s\[])+/g) ?? [];
  function visit(candidate, index) {
    if (!candidate || !matchesSimple(candidate, tokens[index])) return false;
    if (index === 0) return true;
    if (tokens[index - 1] === ">") return visit(candidate.parentElement, index - 2);
    for (let parent = candidate.parentElement; parent; parent = parent.parentElement) if (visit(parent, index - 1)) return true;
    return false;
  }
  return tokens.length > 0 && visit(node, tokens.length - 1);
}

function fixture() {
  const html = new Element("html"); const head = html.appendChild(new Element("head")); const body = html.appendChild(new Element("body"));
  const header = body.appendChild(new Element("header"));
  const brand = header.appendChild(new Element("a", { class: "navbar-brand" }));
  brand.appendChild(new Element("span", { class: "brand-mark" }, "B"));
  brand.appendChild(new Element("strong", {}, "Original brand")); brand.appendChild(new Element("small", {}, "Original tagline"));
  const nav = header.appendChild(new Element("div", { "data-cms": "navigation" }));
  nav.appendChild(new Element("a", { href: "/login" }, "Login"));
  const hero = body.appendChild(new Element("div", { class: "hero-container" }));
  hero.appendChild(new Element("video", { class: "video-background" }));
  hero.appendChild(new Element("div", { class: "hero-overlay" }));
  const content = hero.appendChild(new Element("div", { class: "hero-content" }));
  content.appendChild(new Element("h1", { class: "hero-title" }, "Original heading"));
  content.appendChild(new Element("p", { class: "hero-subtitle" }, "Original subtitle"));
  const buttons = content.appendChild(new Element("div", { class: "hero-actions" }));
  buttons.appendChild(new Element("a", { href: "/portal" }, "Access portal"));
  buttons.appendChild(new Element("a", { href: "/jobs" }, "Apply"));
  const footer = body.appendChild(new Element("footer"));
  footer.appendChild(new Element("p", {}, "Original copyright")); footer.appendChild(new Element("a", { href: "/privacy" }, "Privacy"));
  const script = head.appendChild(new Element("script", { src: "https://cms.example.com/connector/v1/loader.js?site=KEY" }));
  script.nonce = "test-nonce";
  return { html, head, body, header, brand, nav, hero, buttons, footer, script };
}

async function run(data, mappings = [], options = {}) {
  const dom = fixture();
  const events = []; const warnings = []; const requests = [];
  const document = {
    documentElement: dom.html, head: dom.head, body: dom.body, currentScript: dom.script, title: "Original title",
    querySelector(selector) { return selector === ":root" ? dom.html : dom.html.querySelector(selector); },
    querySelectorAll(selector) { return dom.html.querySelectorAll(selector); },
    createElement(tag) { return new Element(tag); },
    dispatchEvent(event) { events.push(event); },
  };
  if (options.noKey) dom.script.src = "https://cms.example.com/connector/v1/loader.js";
  if (options.reportToken) dom.script.setAttribute("data-cms-report-token", options.reportToken);
  const window = { document, location: new URL(options.pageUrl || "https://bavariagarment.de/"), console: {} };
  const payload = { verified: options.verified ?? true, published_version: 7, delivery_revision: "a".repeat(64), data: { overrides: [], ...data }, mappings };
  vm.runInNewContext(source, {
    window, document, URL, CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail.detail; } },
    console: { warn(...args) { warnings.push(args); } },
    async fetch(url, settings) {
      requests.push({ url, settings });
      if (settings.method === "POST") {
        if (options.reportFailure) throw new Error("Reporting unreachable");
        return { ok: true, status: 202 };
      }
      return { ok: !options.httpError, status: options.httpError ?? 200, async json() { return payload; } };
    },
  });
  await new Promise(setImmediate);
  return { ...dom, document, status: window.__CMS_CONNECTOR__, events, warnings, requests };
}

test("site name, browser title and real-world hero class mappings apply independently", async () => {
  const result = await run({ site_name: "BG ERP", hero: { heading: "A fresh start", subheading: "New subtitle" } }, [
    { key: "site_name", selector: '[data-cms="site-name"], header .navbar-brand strong' },
    { key: "hero_heading", selector: '[data-cms="hero-heading"], .hero-title, main h1' },
    { key: "hero_subheading", selector: '[data-cms="hero-subheading"], .hero-subtitle, .hero p' },
  ]);
  assert.equal(result.document.title, "BG ERP");
  assert.equal(result.brand.querySelector("strong").textContent, "BG ERP");
  assert.equal(result.hero.querySelector("h1").textContent, "A fresh start");
  assert.equal(result.hero.querySelector("p").textContent, "New subtitle");
  assert.equal(result.brand.querySelector("small").textContent, "Original tagline");
  assert.equal(result.status.state, "ready");
  assert.equal(result.events[0].type, "cms:ready");
});

test("custom SEO title, description and share image are applied", async () => {
  const result = await run({ site_name: "Brand", seo: { title: "Custom title", description: "Description", keywords: "one,two", og_image: "/media/share.png" } });
  assert.equal(result.document.title, "Custom title");
  assert.equal(result.head.querySelector('meta[name="description"]').getAttribute("content"), "Description");
  assert.equal(result.head.querySelector('meta[property="og:image"]').getAttribute("content"), "https://cms.example.com/media/share.png");
});

test("localhost upload URLs resolve against the actual CMS and a logo can be added to a text brand", async () => {
  const result = await run({ site_name: "Brand", logo_url: "http://localhost:8080/media/logo.png", favicon_url: "/media/icon.png" }, [
    { key: "site_logo", selector: '[data-cms="logo"], header img' }, { key: "favicon", selector: 'link[rel="icon"]' },
  ]);
  assert.equal(result.brand.querySelector("img").src, "https://cms.example.com/media/logo.png");
  assert.equal(result.brand.querySelector("strong").textContent, "Original brand");
  assert.equal(result.head.querySelector('link[rel="icon"]').href, "https://cms.example.com/media/icon.png");
  assert.equal(result.brand.querySelector(".brand-mark").hidden, true);
});

test("explicitly cleared text and favicon are cleared", async () => {
  const result = await run({ hero: { subheading: "" }, favicon_url: "", overrides: ["hero.subheading", "branding.favicon_url"] }, [
    { key: "hero_subheading", selector: ".hero-subtitle" }, { key: "favicon", selector: 'link[rel="icon"]' },
  ]);
  assert.equal(result.hero.querySelector("p").textContent, "");
  assert.equal(result.head.querySelector('link[rel="icon"]'), null);
});

test("default navigation and buttons do not overwrite untouched website functionality", async () => {
  const result = await run({ navigation: { items: [{ label: "Home", url: "/" }] }, hero: { buttons: [{ label: "Get started", url: "#" }] } }, [
    { key: "navigation", selector: '[data-cms="navigation"]' },
    { key: "hero_button", selector: ".hero-actions a" }, { key: "hero_buttons", selector: ".hero-actions" },
  ]);
  assert.equal(result.nav.querySelector("a").href, "/login");
  assert.equal(result.buttons.children.length, 2);
  assert.equal(result.buttons.children[0].textContent, "Access portal");
});

test("clearing an already-absent image or optional text is not a missing-selector failure", async () => {
  const result = await run({ logo_url: "", hero: { eyebrow: "" }, overrides: ["branding.logo_url", "hero.eyebrow"] }, [
    { key: "site_logo", selector: "header img" }, { key: "hero_eyebrow", selector: ".hero-eyebrow" },
  ]);
  assert.equal(result.status.state, "ready");
  assert.equal(result.status.unmatched.length, 0);
});

test("edited navigation and all hero buttons apply, excluding unsafe link schemes", async () => {
  const result = await run({ navigation: { items: [{ label: "About", url: "/about" }, { label: "Unsafe", url: "javascript:alert(1)" }] }, hero: { buttons: [{ label: "Work", url: "/work", variant: "primary" }, { label: "Contact", url: "/contact", variant: "secondary" }] }, overrides: ["navigation.items", "hero.buttons"] }, [
    { key: "navigation", selector: '[data-cms="navigation"]' }, { key: "hero_buttons", selector: ".hero-actions" },
  ]);
  assert.equal(result.nav.children.length, 1);
  assert.equal(result.nav.children[0].href, "https://bavariagarment.de/about");
  assert.equal(result.buttons.children.length, 2);
  assert.equal(result.buttons.children[1].textContent, "Contact");
});

test("footer edits preserve unrelated footer links", async () => {
  const result = await run({ footer_copyright: "Updated copyright", footer: { columns: [{ heading: "Explore", links: [{ label: "About", url: "/about" }] }] }, social: { linkedin: "https://linkedin.com/company/example" }, overrides: ["footer.columns", "social.linkedin"] }, [
    { key: "footer_copyright", selector: "footer" }, { key: "footer_columns", selector: '[data-cms="footer-columns"]' }, { key: "social_links", selector: '[data-cms="social-links"]' },
  ]);
  assert.equal(result.footer.querySelector("p").textContent, "Updated copyright");
  assert.equal(result.footer.querySelector("a").textContent, "Privacy");
  assert.equal(result.footer.querySelector("h4").textContent, "Explore");
  assert.equal(result.footer.querySelector('[data-cms="social-links"] a').rel, "noopener noreferrer");
});

test("theme fonts and colors generate usable CSS and Bootstrap variables", async () => {
  const result = await run({ colors: { primary: "#2563eb", background: "#fff", text: "#123" }, typography: { heading_font: "Georgia", body_font: "Arial", base_size: 18 }, overrides: ["theme.colors.primary", "theme.typography"] }, [{ key: "theme_colors", selector: ":root" }]);
  assert.equal(result.html.style["--bs-primary-rgb"], "37,99,235");
  assert.equal(result.html.style["--cms-heading-font"], "Georgia");
  assert.match(result.head.querySelector('style[data-cms="theme"]').textContent, /font-family:var\(--cms-heading-font\)/);
});

test("a hero background replaces decorative video and applies alignment and opacity", async () => {
  const result = await run({ hero: { background_image: "/media/hero.png", alignment: "left", overlay_opacity: 0.2 }, overrides: ["hero.background_image", "hero.alignment", "hero.overlay_opacity"] }, [{ key: "hero_background", selector: ".hero-container" }]);
  assert.match(result.hero.style.backgroundImage, /https:\/\/cms.example.com\/media\/hero.png/);
  assert.equal(result.hero.querySelector("video").hidden, true);
  assert.equal(result.hero.querySelector(".hero-content").style.textAlign, "left");
  assert.equal(result.hero.querySelector(".hero-overlay").style.opacity, "0.2");
});

test("one invalid or missing selector does not prevent other fields from updating", async () => {
  const result = await run({ site_name: "Updated", hero: { heading: "Updated heading", subheading: "Missing" } }, [
    { key: "site_name", selector: "[" }, { key: "hero_heading", selector: "h1" }, { key: "hero_subheading", selector: ".not-present" },
  ]);
  assert.equal(result.status.state, "partial");
  assert.equal(result.status.errors[0].key, "site_name");
  assert.equal(result.status.unmatched[0].key, "hero_subheading");
  assert.equal(result.hero.querySelector("h1").textContent, "Updated heading");
});

test("unverified sites cannot execute custom code; verified scripts preserve the nonce", async () => {
  const unverified = await run({ custom_js: "window.changed=true", custom_css: "body{color:red}" }, [], { verified: false });
  assert.equal(unverified.head.querySelector("script[data-cms-custom]"), null);
  assert.equal(unverified.head.querySelector('style[data-cms="custom"]'), null);
  const verified = await run({ custom_js: "window.changed=true" });
  assert.equal(verified.head.querySelector("script[data-cms-custom]").nonce, "test-nonce");
});

test("config requests revalidate without cookies and errors are visible diagnostically", async () => {
  const result = await run({}, [], { httpError: 404 });
  assert.equal(result.requests[0].url, "https://cms.example.com/connector/v1/config/KEY/");
  assert.equal(result.requests[0].settings.cache, "no-cache");
  assert.equal(result.requests[0].settings.credentials, "omit");
  assert.equal(result.status.state, "error");
  assert.match(result.status.errors[0], /404/);
  const missing = await run({}, [], { noKey: true });
  assert.equal(missing.requests.length, 0);
  assert.equal(missing.status.state, "error");
});

test("a signed loader reports the applied version without credentials or URL secrets", async () => {
  const result = await run({ site_name: "Reported brand" }, [{ key: "site_name", selector: "header strong" }], { reportToken: "signed-ticket", pageUrl: "https://bavariagarment.de/about?token=private#account" });
  assert.equal(result.status.state, "ready");
  assert.equal(result.status.reporting, "sent");
  const request = result.requests[1];
  assert.equal(request.url, "https://cms.example.com/connector/v1/reports/KEY/");
  assert.equal(request.settings.credentials, "omit");
  assert.equal(request.settings.referrerPolicy, "no-referrer");
  assert.equal(request.settings.keepalive, true);
  assert.equal(request.settings.headers["Content-Type"], "text/plain");
  const body = JSON.parse(request.settings.body);
  assert.equal(body.token, "signed-ticket");
  assert.equal(body.version, 7);
  assert.equal(body.revision, "a".repeat(64));
  assert.equal(body.page_path, "/about");
  assert.ok(body.applied.includes("site_name"));
  assert.ok(!request.settings.body.includes("private"));
});

test("reports include per-field missing selectors and application errors", async () => {
  const result = await run({ site_name: "Brand", hero: { heading: "Missing" } }, [{ key: "site_name", selector: "[" }, { key: "hero_heading", selector: ".absent" }], { reportToken: "ticket" });
  const body = JSON.parse(result.requests[1].settings.body);
  assert.equal(body.state, "partial");
  assert.equal(body.unmatched[0].key, "hero_heading");
  assert.equal(body.unmatched[0].selector, ".absent");
  assert.equal(body.errors[0].key, "site_name");
});

test("configuration failures are reportable even when no version was loaded", async () => {
  const result = await run({}, [], { reportToken: "ticket", httpError: 503 });
  const body = JSON.parse(result.requests[1].settings.body);
  assert.equal(body.state, "error");
  assert.equal(body.version, null);
  assert.equal(body.revision, "");
  assert.equal(body.errors[0].key, "configuration");
  assert.match(body.errors[0].message, /503/);
});

test("reporting failures never undo applied content or change its result", async () => {
  const result = await run({ site_name: "Still applied" }, [], { reportToken: "ticket", reportFailure: true });
  assert.equal(result.document.title, "Still applied");
  assert.equal(result.status.state, "ready");
  assert.equal(result.status.reporting, "unreachable");
  assert.equal(result.events.length, 1);
});

test("unsigned installations do not submit unscoped reports", async () => {
  const result = await run({ site_name: "Unsigned" });
  assert.equal(result.requests.length, 1);
  assert.equal(result.status.reporting, "unavailable");
});
