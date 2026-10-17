/* CMS connector v3. Published configuration only; custom code requires ownership. */
(function () {
  "use strict";

  var currentScript = document.currentScript;
  var nonce = currentScript && currentScript.nonce;
  var reportToken = currentScript && currentScript.getAttribute("data-cms-report-token");
  var deliveryRevision = "";

  function findSite() {
    var script = currentScript || document.querySelector("script[data-cms-site]");
    if (!script) return null;
    try {
      var url = new URL(script.src || window.location.href, window.location.href);
      var key = url.searchParams.get("site") || script.getAttribute("data-cms-site");
      if (key) return { origin: url.origin, key: key };
    } catch (_) { /* Report an invalid installation below. */ }
    return null;
  }

  var site = findSite();
  var status = { state: "loading", origin: site && site.origin, version: null, applied: [], unmatched: [], errors: [] };
  window.__CMS_CONNECTOR__ = status;
  if (!site) {
    status.state = "error";
    status.errors.push("No connector site key found. Check the installed script tag.");
    if (window.console) console.warn("[cms]", status.errors[0]);
    return;
  }

  function changed(data, path) {
    if (!Array.isArray(data.overrides)) return true;
    return data.overrides.some(function (edit) {
      return edit === path || edit.indexOf(path + ".") === 0 || path.indexOf(edit + ".") === 0;
    });
  }

  function supplied(data, path, value) {
    return value !== undefined && value !== null && (value !== "" || changed(data, path));
  }

  function text(el, value) {
    if (!el) return value === "" ? null : false;
    el.textContent = value == null ? "" : String(value);
    return true;
  }

  function linkLabel(el, value) {
    var icon = el.querySelector("i, svg");
    var copy = icon && icon.cloneNode(true);
    text(el, value);
    if (copy) el.insertBefore(copy, el.firstChild);
  }

  function localHost(host) {
    return host === "localhost" || /^(127\.|\[?::1\]?$)/.test(host) || /^(backend|nginx|daphne)$/.test(host);
  }

  function safeUrl(value, asset) {
    if (!value || typeof value !== "string") return "";
    if (asset && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)) return value;
    try {
      var base = asset && /^\/?media\//.test(value) ? site.origin + "/" : window.location.href;
      var url = new URL(value, base);
      if (asset && localHost(url.hostname) && url.pathname.indexOf("/media/") === 0) {
        url = new URL(url.pathname + url.search + url.hash, site.origin);
      }
      var permitted = asset ? /^(https?:)$/ : /^(https?:|mailto:|tel:)$/;
      if (!permitted.test(url.protocol) || url.username || url.password) return "";
      return url.href;
    } catch (_) { return ""; }
  }

  function image(el, value) {
    if (!el) return value ? false : null;
    var url = safeUrl(value, true);
    if (value && !url) throw new Error("Unsupported image URL");
    if (el.tagName === "IMG") {
      if (url) { el.src = url; el.hidden = false; }
      else { el.removeAttribute("src"); el.hidden = true; }
    } else {
      el.style.backgroundImage = url ? "url(" + JSON.stringify(url) + ")" : "none";
      if (url) { el.style.backgroundSize = "cover"; el.style.backgroundPosition = "center"; }
      Array.from(el.querySelectorAll("video.video-background, video[data-cms-background]")).forEach(function (video) {
        video.hidden = Boolean(url);
      });
    }
    return true;
  }

  function meta(attribute, name, value) {
    var selector = "meta[" + attribute + '="' + name + '"]';
    var elements = Array.from(document.querySelectorAll(selector));
    if (!elements.length && value) {
      var element = document.createElement("meta");
      element.setAttribute(attribute, name);
      document.head.appendChild(element);
      elements.push(element);
    }
    elements.forEach(function (element) { element.setAttribute("content", value || ""); });
  }

  function applyMetadata(data) {
    var seo = data.seo || {};
    var title = seo.title || data.site_name;
    if (title) { document.title = title; meta("property", "og:title", title); meta("name", "twitter:title", title); }
    if (supplied(data, "seo.description", seo.description)) {
      meta("name", "description", seo.description);
      meta("property", "og:description", seo.description);
      meta("name", "twitter:description", seo.description);
    }
    if (supplied(data, "seo.keywords", seo.keywords)) meta("name", "keywords", seo.keywords);
    if (supplied(data, "seo.og_image", seo.og_image)) {
      var og = safeUrl(seo.og_image, true);
      meta("property", "og:image", og); meta("name", "twitter:image", og);
    }
    status.applied.push("metadata");
  }

  function managedContainer(el, hook, parent) {
    if (el) return el;
    if (!parent) return null;
    var container = document.createElement("div");
    container.setAttribute("data-cms", hook);
    container.setAttribute("data-cms-generated", "true");
    parent.appendChild(container);
    return container;
  }

  function makeLink(item, className) {
    var href = item && safeUrl(item.url, false);
    if (!href) return null;
    var link = document.createElement("a");
    link.href = href;
    link.className = className || "";
    text(link, item.label || "");
    return link;
  }

  function replaceLinks(el, items, className) {
    if (!el || !Array.isArray(items)) return false;
    el.replaceChildren();
    items.forEach(function (item) {
      var link = makeLink(item, className);
      if (!link) return;
      if (el.tagName === "UL" || el.tagName === "OL") {
        var li = document.createElement("li"); li.appendChild(link); el.appendChild(li);
      } else el.appendChild(link);
    });
    return true;
  }

  function styleTag(hook, content) {
    var style = document.querySelector('style[data-cms="' + hook + '"]');
    if (!style) {
      style = document.createElement("style"); style.setAttribute("data-cms", hook);
      if (nonce) style.nonce = nonce;
      document.head.appendChild(style);
    }
    style.textContent = content;
  }

  function applyTheme(data) {
    var colors = data.colors || {};
    var typography = data.typography || {};
    var root = document.documentElement;
    var rules = [];
    ["primary", "secondary", "background", "text"].forEach(function (name) {
      var value = colors[name];
      if (!value) return;
      if (window.CSS && window.CSS.supports && !window.CSS.supports("color", value)) return;
      root.style.setProperty("--cms-" + name, value);
      if (name === "primary" || name === "secondary") {
        root.style.setProperty("--bs-" + name, value);
        var hex = /^#([a-f\d]{6})$/i.exec(value);
        if (hex) root.style.setProperty("--bs-" + name + "-rgb", [0, 2, 4].map(function (i) { return parseInt(hex[1].slice(i, i + 2), 16); }).join(","));
      }
    });
    if (changed(data, "theme.colors")) {
      if (colors.background) rules.push("body,.bg-white{background-color:var(--cms-background)!important}");
      if (colors.text) rules.push("body,.text-dark{color:var(--cms-text)!important}");
      if (colors.primary) rules.push(".btn-primary,.btn-premium,[data-cms=primary-button]{background:var(--cms-primary)!important;border-color:var(--cms-primary)!important}.text-primary{color:var(--cms-primary)!important}");
    }
    if (changed(data, "theme.typography")) {
      if (typography.body_font) { root.style.setProperty("--cms-body-font", typography.body_font); rules.push("body{font-family:var(--cms-body-font)!important}"); }
      if (typography.heading_font) { root.style.setProperty("--cms-heading-font", typography.heading_font); rules.push("h1,h2,h3,h4,h5,h6{font-family:var(--cms-heading-font)!important}"); }
      var size = Number(typography.base_size);
      if (Number.isFinite(size) && size >= 12 && size <= 24) { root.style.setProperty("--cms-font-size", size + "px"); rules.push("html,body{font-size:var(--cms-font-size)!important}"); }
    }
    styleTag("theme", rules.join("\n"));
    return true;
  }

  function applyMapping(mapping, data) {
    var el = mapping.selector ? document.querySelector(mapping.selector) : null;
    var hero = data.hero || {};
    var footer = data.footer || {};
    var header = data.header || {};
    var value;
    switch (mapping.key) {
      case "site_name":
        return supplied(data, "general.site_name", data.site_name) ? text(el, data.site_name) : null;
      case "site_tagline":
        return supplied(data, "general.tagline", data.tagline) ? text(el, data.tagline) : null;
      case "site_logo":
        if (!supplied(data, "branding.logo_url", data.logo_url) && !changed(data, "header.logo_url")) return null;
        if (!el && data.logo_url && mapping.selector.indexOf("header img") !== -1) {
          var brand = document.querySelector('[data-cms="brand"], header .navbar-brand, header .brand');
          if (brand) {
            el = document.createElement("img"); el.setAttribute("data-cms", "logo");
            el.alt = data.site_name || "Logo"; el.style.maxHeight = "40px"; el.style.width = "auto";
            brand.insertBefore(el, brand.firstChild);
            var mark = brand.querySelector(".brand-mark"); if (mark) mark.hidden = true;
          }
        }
        return image(el, data.logo_url);
      case "header_settings":
        if (!changed(data, "header.layout") && !changed(data, "header.sticky")) return null;
        if (!el) return false;
        if (changed(data, "header.sticky")) { el.style.position = header.sticky ? "sticky" : "static"; el.style.top = header.sticky ? "0" : ""; el.style.zIndex = header.sticky ? "100" : ""; }
        if (changed(data, "header.layout")) {
          var layout = el.querySelector(".navbar > .container") || el;
          layout.style.display = "flex"; layout.style.flexDirection = header.layout === "center" ? "column" : "row";
          layout.style.alignItems = "center"; layout.style.justifyContent = "space-between";
          el.setAttribute("data-cms-layout", header.layout === "center" ? "center" : "left");
        }
        return true;
      case "header_cta":
        if (!supplied(data, "header.cta_text", data.header_cta_text) && !changed(data, "header.cta_url")) return null;
        if (!el) return false;
        if (supplied(data, "header.cta_text", data.header_cta_text)) linkLabel(el, data.header_cta_text);
        value = safeUrl(data.header_cta_url, false); if (el.tagName === "A" && value) el.href = value;
        return true;
      case "navigation":
        if (!changed(data, "navigation.items")) return null;
        return replaceLinks(el, (data.navigation || {}).items, "nav-link");
      case "hero_eyebrow":
        return supplied(data, "hero.eyebrow", hero.eyebrow) ? text(el, hero.eyebrow) : null;
      case "hero_heading":
        return supplied(data, "hero.heading", hero.heading) ? text(el, hero.heading) : null;
      case "hero_subheading":
        return supplied(data, "hero.subheading", hero.subheading) ? text(el, hero.subheading) : null;
      case "hero_background":
        var applied = null;
        if (supplied(data, "hero.background_image", hero.background_image)) applied = image(el, hero.background_image);
        if (el && changed(data, "hero.alignment")) {
          var content = el.querySelector('[data-cms="hero-content"], .hero-content') || el;
          var alignment = /^(left|center|right)$/.test(hero.alignment) ? hero.alignment : "center";
          content.style.textAlign = alignment; content.style.alignItems = alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center"; applied = true;
        }
        if (el && changed(data, "hero.overlay_opacity")) {
          var overlay = el.querySelector('[data-cms="hero-overlay"], .hero-overlay');
          if (overlay) { overlay.style.opacity = String(Math.min(1, Math.max(0, Number(hero.overlay_opacity) || 0))); applied = true; }
        }
        return applied;
      case "hero_button":
        if (!changed(data, "hero.buttons") || !Array.isArray(hero.buttons) || !hero.buttons.length) return null;
        if (!el) return false;
        linkLabel(el, hero.buttons[0].label);
        value = safeUrl(hero.buttons[0].url, false); if (el.tagName === "A" && value) el.href = value;
        return true;
      case "hero_buttons":
        if (!changed(data, "hero.buttons")) return null;
        if (!el || !Array.isArray(hero.buttons)) return false;
        el.replaceChildren();
        hero.buttons.forEach(function (button) {
          var link = makeLink(button, button.variant === "secondary" ? "btn btn-outline-primary" : "btn btn-primary");
          if (link) el.appendChild(link);
        });
        return true;
      case "footer_copyright":
        if (!supplied(data, "footer.copyright", data.footer_copyright)) return null;
        if (el && el.tagName === "FOOTER") el = el.querySelector('[data-cms="copyright"], .copyright, small, p');
        if (!el && mapping.selector.indexOf("footer") !== -1) {
          var copyrightParent = document.querySelector("footer");
          if (copyrightParent) { el = document.createElement("p"); el.setAttribute("data-cms", "copyright"); copyrightParent.appendChild(el); }
        }
        return text(el, data.footer_copyright);
      case "footer_columns":
        if (!changed(data, "footer.columns")) return null;
        el = managedContainer(el, "footer-columns", document.querySelector("footer"));
        if (!el || !Array.isArray(footer.columns)) return false;
        el.replaceChildren(); el.style.display = "flex"; el.style.flexWrap = "wrap"; el.style.gap = "2rem";
        footer.columns.forEach(function (column) {
          var section = document.createElement("div"); var heading = document.createElement("h4"); text(heading, column.heading); section.appendChild(heading);
          var links = document.createElement("ul"); replaceLinks(links, column.links, ""); section.appendChild(links); el.appendChild(section);
        });
        return true;
      case "footer_newsletter":
        if (!changed(data, "footer.show_newsletter")) return null;
        if (!el) return footer.show_newsletter ? false : null;
        el.hidden = !footer.show_newsletter; return true;
      case "social_links":
        if (!changed(data, "social")) return null;
        el = managedContainer(el, "social-links", document.querySelector("footer"));
        if (!el) return false;
        el.replaceChildren(); el.style.display = "flex"; el.style.gap = "1rem"; el.style.flexWrap = "wrap";
        ["facebook", "x", "instagram", "linkedin", "youtube"].forEach(function (network) {
          var link = makeLink({ label: network === "x" ? "X" : network.charAt(0).toUpperCase() + network.slice(1), url: (data.social || {})[network] });
          if (link) { link.rel = "noopener noreferrer"; link.target = "_blank"; el.appendChild(link); }
        });
        return true;
      case "favicon":
        if (!supplied(data, "branding.favicon_url", data.favicon_url)) return null;
        var icons = Array.from(document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]'));
        if (el && el.tagName === "LINK" && icons.indexOf(el) === -1) icons.push(el);
        value = safeUrl(data.favicon_url, true);
        if (data.favicon_url && !value) throw new Error("Unsupported favicon URL");
        if (!value) { icons.forEach(function (icon) { icon.remove(); }); return true; }
        if (!icons.length) { el = document.createElement("link"); el.rel = "icon"; document.head.appendChild(el); icons.push(el); }
        icons.forEach(function (icon) { icon.href = value; icon.removeAttribute("type"); icon.removeAttribute("sizes"); });
        return true;
      case "cover_image":
        if (!supplied(data, "cover.image_url", data.cover_image)) return null;
        var coverApplied = image(el, data.cover_image);
        if (el && changed(data, "cover.overlay_opacity")) {
          var coverOverlay = el.querySelector('[data-cms="cover-overlay"], .cover-overlay, .hero-overlay');
          if (coverOverlay) coverOverlay.style.opacity = String(Math.min(1, Math.max(0, Number(data.cover_overlay_opacity) || 0)));
        }
        return coverApplied;
      case "theme_colors":
        return applyTheme(data);
      default:
        return null;
    }
  }

  function pagePath(value) {
    var path = String(value || "/").split("?")[0].split("#")[0];
    if (path.charAt(0) !== "/") path = "/" + path;
    path = path.replace(/\/+$/, "");
    return path || "/";
  }

  function applyPageBlocks(blocks) {
    if (!Array.isArray(blocks) || !blocks.length) return;
    var current = pagePath(window.location.pathname);
    blocks.forEach(function (block) {
      if (!block || typeof block.selector !== "string" || !block.selector) return;
      if (pagePath(block.path) !== current) return;
      var label = "page:" + (block.label || block.id || "text");
      try {
        var el = document.querySelector(block.selector);
        if (!el) { status.unmatched.push({ key: label, selector: block.selector }); return; }
        if (typeof block.text !== "string" || block.text === "") return;
        text(el, block.text);
        status.applied.push(label);
      } catch (error) { status.errors.push({ key: label, message: error.message }); }
    });
  }

  function applyConfig(cfg) {
    if (!cfg || !cfg.data) throw new Error("Published configuration is missing data");
    var data = cfg.data;
    status.version = cfg.published_version || null;
    deliveryRevision = cfg.delivery_revision || "";
    applyMetadata(data);
    (cfg.mappings || []).forEach(function (mapping) {
      try {
        var result = applyMapping(mapping, data);
        if (result === true) status.applied.push(mapping.key);
        if (result === false) status.unmatched.push({ key: mapping.key, selector: mapping.selector });
      } catch (error) { status.errors.push({ key: mapping.key, message: error.message }); }
    });
    applyPageBlocks(cfg.blocks);
    if (cfg.verified && (data.custom_css || changed(data, "custom.css"))) styleTag("custom", data.custom_css || "");
    if (cfg.verified && data.custom_js && !document.querySelector("script[data-cms-custom]")) {
      var script = document.createElement("script"); script.setAttribute("data-cms-custom", "true");
      if (nonce) script.nonce = nonce;
      script.textContent = data.custom_js; document.head.appendChild(script);
    }
    status.state = status.errors.length || status.unmatched.length ? "partial" : "ready";
    if (status.unmatched.length && window.console) console.warn("[cms] Some fields need matching website elements:", status.unmatched);
    document.dispatchEvent(new CustomEvent("cms:ready", { detail: status }));
  }

  function reportDelivery() {
    // Reporting is best-effort and must never interfere with the website.
    // No credentials, full URL, query strings, or fragments are collected.
    if (!reportToken) { status.reporting = "unavailable"; return; }
    if (status.state !== "error" && (!status.version || !deliveryRevision)) {
      status.reporting = "unavailable"; return;
    }
    try {
      status.reporting = "sending";
      fetch(site.origin + "/connector/v1/reports/" + encodeURIComponent(site.key) + "/", {
        method: "POST", mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", keepalive: true,
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({
          token: reportToken, version: status.version, revision: deliveryRevision,
          state: status.state, page_path: window.location.pathname.slice(0, 1024),
          applied: status.applied.slice(0, 40),
          unmatched: status.unmatched.slice(0, 40).map(function (field) {
            return { key: field.key, selector: String(field.selector || "").slice(0, 255) };
          }),
          errors: status.errors.slice(0, 40).map(function (error) {
            return { key: error.key || "configuration", message: String(error.message || error).slice(0, 300) };
          }),
        }),
      }).then(function (response) {
        status.reporting = response.ok ? "sent" : "rejected";
      }).catch(function () { status.reporting = "unreachable"; });
    } catch (_) { status.reporting = "unreachable"; }
  }

  fetch(site.origin + "/connector/v1/config/" + encodeURIComponent(site.key) + "/", {
    headers: { Accept: "application/json" }, cache: "no-cache", credentials: "omit",
  }).then(function (response) {
    if (!response.ok) throw new Error("Published config HTTP " + response.status);
    return response.json();
  }).then(applyConfig).catch(function (error) {
    status.state = "error"; status.errors.push(error.message);
    if (window.console) console.warn("[cms] Unable to apply published changes:", error);
  }).then(reportDelivery);
})();
