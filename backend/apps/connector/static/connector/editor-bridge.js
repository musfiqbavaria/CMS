/* CMS-only preview inspector. Never installed on the real website. */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || window.parent === window) return;
  var config;
  try { config = JSON.parse(script.getAttribute("data-cms-editor-config")); } catch (_) { return; }
  if (!config || !/^[a-zA-Z0-9_-]{16,128}$/.test(config.channel) || !Array.isArray(config.targets)) return;
  function normalizePath(value) {
    var path = String(value || "/").split("?")[0].split("#")[0];
    if (path.charAt(0) !== "/") path = "/" + path;
    path = path.replace(/\/+$/, "");
    return path || "/";
  }
  var pagePath = new URLSearchParams(window.location.search).get("path") || "/";
  var currentPath = normalizePath(pagePath);
  var targets = config.targets.filter(function (target) {
    if (!target || typeof target.key !== "string" || typeof target.selector !== "string" || target.selector.length > 255) return false;
    return !target.path || normalizePath(target.path) === currentPath;
  });
  var enabled = false, configured = false, selected = null, hovered = null, host, box, label;
  var accessible = new Map();

  function send(type, fields) {
    window.parent.postMessage(Object.assign({ type: "cms:editor:" + type, channel: config.channel }, fields), config.parentOrigin);
  }

  function elements(target) {
    try {
      return Array.from(document.querySelectorAll(target.selector)).filter(function (element) {
        return element !== document.documentElement && (element !== document.body || element.hasAttribute("data-cms-edit")) && !/^(HEAD|SCRIPT|STYLE|LINK|META|TITLE)$/.test(element.tagName);
      });
    } catch (_) { return []; }
  }

  function hit(element) {
    if (!(element instanceof Element)) return null;
    while (element && element !== document.documentElement) {
      for (var i = 0; i < targets.length; i++) {
        try {
          if (element.matches(targets[i].selector) && element !== document.documentElement && (element !== document.body || element.hasAttribute("data-cms-edit"))) return { element: element, target: targets[i] };
        } catch (_) { /* An invalid mapping must not break other editable areas. */ }
      }
      element = element.parentElement;
    }
    return null;
  }

  function draw() {
    if (!box) return;
    var current = hovered || selected;
    if (!enabled || !current || !current.element.isConnected) { box.hidden = true; return; }
    var rect = current.element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > window.innerHeight) { box.hidden = true; return; }
    box.hidden = false;
    box.style.left = Math.max(1, rect.left) + "px";
    box.style.top = Math.max(1, rect.top) + "px";
    box.style.width = Math.max(0, Math.min(rect.right, window.innerWidth - 1) - Math.max(1, rect.left)) + "px";
    box.style.height = Math.max(0, Math.min(rect.bottom, window.innerHeight - 1) - Math.max(1, rect.top)) + "px";
    label.textContent = (current.target.label || current.target.key) + " · " + (hovered ? "Click to edit" : "Selected");
  }

  function keyboardTargets() {
    var count = 0;
    targets.forEach(function (target) {
      elements(target).forEach(function (element) {
        if (!element.getClientRects().length) return;
        count++;
        if (enabled && !accessible.has(element) && !element.matches("a, button, input, select, textarea, [tabindex]")) {
          accessible.set(element, { role: element.getAttribute("role"), label: element.getAttribute("aria-label") });
          element.setAttribute("tabindex", "0"); element.setAttribute("role", "button");
          element.setAttribute("aria-label", "Edit " + (target.label || target.key));
        }
      });
    });
    if (!enabled) {
      accessible.forEach(function (previous, element) {
        element.removeAttribute("tabindex");
        if (previous.role === null) element.removeAttribute("role"); else element.setAttribute("role", previous.role);
        if (previous.label === null) element.removeAttribute("aria-label"); else element.setAttribute("aria-label", previous.label);
      });
      accessible.clear();
    }
    return count;
  }

  // Suggest a stable selector + label for an unmapped element so the parent can
  // offer "make this text editable on this page".
  function selectorOf(element) {
    if (!(element instanceof Element) || element === document.documentElement || element === document.body) return null;
    var chain = [];
    var node = element;
    var depth = 0;
    while (node && node instanceof Element && node !== document.documentElement && node !== document.body && depth < 6) {
      var part = node.tagName.toLowerCase();
      var qualified = false;
      var id = node.getAttribute("id") || "";
      var classes = (node.getAttribute("class") || "").trim().split(/\s+/).filter(function (name) {
        return /^[A-Za-z][\w-]{0,40}$/.test(name);
      }).slice(0, 3);
      if (/^[A-Za-z][\w-]{0,60}$/.test(id)) { part = "#" + id; qualified = true; }
      else if (classes.length) { part += "." + classes.join("."); qualified = true; }
      chain.unshift(part);
      var candidate = chain.join(" ");
      if (candidate.length > 255) break;
      try {
        if (document.querySelectorAll(candidate).length === 1 && (chain.length >= 2 || qualified)) return candidate;
      } catch (_) { return null; }
      depth++;
      node = node.parentElement;
    }
    var last = chain.join(" ");
    if (last && last.length <= 255) {
      try { if (document.querySelectorAll(last).length === 1) return last; } catch (_) { return null; }
    }
    return null;
  }

  function suggestionFor(element) {
    var selector = selectorOf(element);
    if (!selector) return {};
    var copy = (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
    return { path: currentPath, selector: selector, label: copy || element.tagName.toLowerCase() };
  }

  function pick(current, source) {
    if (!current) { send("unmapped", suggestionFor(source)); return; }
    selected = current; hovered = null; draw(); send("select", { key: current.target.key });
  }

  // Links keep browsing the original site: same-site clicks move the preview to
  // the next page, modified clicks and new-tab targets open the real page in a
  // browser tab. Everything else stays read-only.
  function previewPrefix() {
    var match = /^\/connector\/v1\/preview\/[^/]+\/$/.exec(window.location.pathname);
    return match ? match[0] : null;
  }

  function browse(url, prefix) {
    // Absolute URL on purpose: the preview injects <base href="…original site…">,
    // and relative location assignments resolve against it, which would send the
    // frame to the original site instead of this preview endpoint.
    var origin = window.location.protocol + "//" + window.location.host;
    window.location.href =
      origin + prefix + "?path=" + encodeURIComponent(url.pathname + url.search) +
      "&edit_channel=" + encodeURIComponent(config.channel) + url.hash;
  }

  function follow(anchor, newTab) {
    var prefix = previewPrefix();
    var base = document.querySelector("base");
    if (!prefix || !base || !base.href) return;
    var raw = anchor.getAttribute("href");
    if (!raw) return;
    if (raw.charAt(0) === "#") {
      var target = raw.length > 1 ? document.getElementById(raw.slice(1)) : null;
      if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
      return;
    }
    var url;
    try { url = new URL(raw, base.href); } catch (_) { return; }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    var sameSite = url.origin === new URL(base.href).origin;
    if (sameSite && !newTab) { browse(url, prefix); return; }
    if (window.open(url.href, "_blank", "noopener")) return;
    if (sameSite) browse(url, prefix);
  }

  function anchorOf(event) {
    return event.target instanceof Element ? event.target.closest("a[href]") : null;
  }

  function modified(event, anchor) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
      anchor.getAttribute("target") === "_blank";
  }

  window.addEventListener("click", function (event) {
    var anchor = anchorOf(event);
    if (enabled) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (anchor && modified(event, anchor)) follow(anchor, true);
      else pick(hit(event.target), event.target);
      return;
    }
    if (anchor) {
      event.preventDefault(); event.stopImmediatePropagation();
      follow(anchor, modified(event, anchor));
      return;
    }
    if (event.target instanceof Element && event.target.closest("button, input[type=submit]")) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  window.addEventListener("auxclick", function (event) {
    var anchor = anchorOf(event);
    event.preventDefault(); event.stopImmediatePropagation();
    if (anchor) follow(anchor, true);
  }, true);
  window.addEventListener("submit", function (event) { event.preventDefault(); event.stopImmediatePropagation(); }, true);
  window.addEventListener("keydown", function (event) {
    if (enabled && (event.key === "Enter" || event.key === " ") && hit(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation(); pick(hit(event.target), event.target);
    }
  }, true);
  window.addEventListener("pointermove", function (event) { if (enabled) { hovered = hit(event.target); draw(); } }, { passive: true });
  window.addEventListener("focusin", function (event) { if (enabled) { hovered = hit(event.target); draw(); } });
  window.addEventListener("pointerout", function (event) { if (!event.relatedTarget) { hovered = null; draw(); } });
  var scrolling = false;
  window.addEventListener("scroll", function () {
    draw();
    if (configured && !scrolling) {
      scrolling = true;
      requestAnimationFrame(function () { scrolling = false; send("scroll", { y: window.scrollY }); });
    }
  }, { passive: true });
  window.addEventListener("resize", draw);
  window.addEventListener("load", function () { if (box) send("ready", { count: Math.min(10_000, keyboardTargets()), path: pagePath }); }, { once: true });
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (event.source !== window.parent || event.origin !== config.parentOrigin || !data || data.channel !== config.channel) return;
    if (data.type === "cms:editor:ping") { if (box) send("ready", { count: Math.min(10_000, keyboardTargets()), path: pagePath }); return; }
    if (data.type === "cms:editor:back") { window.history.back(); return; }
    if (data.type === "cms:editor:forward") { window.history.forward(); return; }
    if (data.type !== "cms:editor:configure") return;
    enabled = data.enabled === true; configured = true;
    selected = null;
    if (typeof data.key === "string") {
      var target = targets.find(function (item) { return item.key === data.key; });
      var element = target && elements(target)[0];
      if (element) selected = { element: element, target: target };
    }
    keyboardTargets();
    if (typeof data.y === "number" && Number.isFinite(data.y)) window.scrollTo(0, Math.max(0, Math.min(10_000_000, data.y)));
    draw();
  });

  function boot() {
    host = document.createElement("div");
    host.setAttribute("data-cms-editor-overlay", "");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    var shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = '<style>:host{pointer-events:none!important}div{position:fixed;box-sizing:border-box;border:2px solid #2563eb;border-radius:4px;background:rgb(37 99 235 / .07);pointer-events:none}div[hidden]{display:none}span{position:absolute;left:0;top:0;max-width:100%;box-sizing:border-box;padding:5px 8px;border-radius:0 0 5px 0;background:#1d4ed8;color:#fff;font:600 11px/1.5 system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style><div hidden><span></span></div>';
    box = shadow.querySelector("div"); label = shadow.querySelector("span");
    document.body.appendChild(host);
    send("ready", { count: Math.min(10_000, keyboardTargets()), path: pagePath });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})();
