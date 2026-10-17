/* CMS-only preview inspector. Never installed on the real website. */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script || window.parent === window) return;
  var config;
  try { config = JSON.parse(script.getAttribute("data-cms-editor-config")); } catch (_) { return; }
  if (!config || !/^[a-zA-Z0-9_-]{16,128}$/.test(config.channel) || !Array.isArray(config.targets)) return;
  var targets = config.targets.filter(function (target) {
    return target && typeof target.key === "string" && typeof target.selector === "string" && target.selector.length <= 255;
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

  function pick(current) {
    if (!current) { send("unmapped"); return; }
    selected = current; hovered = null; draw(); send("select", { key: current.target.key });
  }

  // Both modes remain read-only. Capture before website handlers can navigate or submit.
  window.addEventListener("click", function (event) {
    if (enabled || (event.target instanceof Element && event.target.closest("a, button, input[type=submit]"))) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (enabled) pick(hit(event.target));
    }
  }, true);
  window.addEventListener("auxclick", function (event) { event.preventDefault(); event.stopImmediatePropagation(); }, true);
  window.addEventListener("submit", function (event) { event.preventDefault(); event.stopImmediatePropagation(); }, true);
  window.addEventListener("keydown", function (event) {
    if (enabled && (event.key === "Enter" || event.key === " ") && hit(event.target)) {
      event.preventDefault(); event.stopImmediatePropagation(); pick(hit(event.target));
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
  window.addEventListener("load", function () { if (box) send("ready", { count: Math.min(10_000, keyboardTargets()) }); }, { once: true });
  window.addEventListener("message", function (event) {
    var data = event.data;
    if (event.source !== window.parent || event.origin !== config.parentOrigin || !data || data.channel !== config.channel) return;
    if (data.type === "cms:editor:ping") { if (box) send("ready", { count: Math.min(10_000, keyboardTargets()) }); return; }
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
    send("ready", { count: Math.min(10_000, keyboardTargets()) });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})();
