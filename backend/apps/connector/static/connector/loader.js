/* CMS connector loader. Include once:
 * <script src="https://CMS_HOST/connector/v1/loader.js?site=SITE_KEY" async></script>
 * or <script data-cms-site="SITE_KEY" src=".../loader.js">.
 * Fetches the published config and applies it through admin-defined selectors.
 */
(function () {
  "use strict";

  function findSite() {
    try {
      var current = document.currentScript;
      if (current && current.src) {
        var u = new URL(current.src, window.location.href);
        var key = u.searchParams.get("site");
        if (key) return { origin: u.origin, key: key };
      }
    } catch (e) {
      /* fall through to data attribute */
    }
    var tagged = document.querySelector('script[data-cms-site]');
    if (tagged) {
      var k = tagged.getAttribute("data-cms-site");
      var src = tagged.getAttribute("src") || "";
      var origin = window.location.origin;
      try {
        if (src) origin = new URL(src, window.location.href).origin;
      } catch (e) {
        /* keep location origin */
      }
      if (k) return { origin: origin, key: k };
    }
    return null;
  }

  function setText(el, value) {
    if (el && value) el.textContent = value;
  }

  function applyMapping(m, data) {
    var el = null;
    try {
      el = m.selector ? document.querySelector(m.selector) : null;
    } catch (e) {
      return;
    }
    var hero = data.hero || {};
    switch (m.key) {
      case "site_logo":
        if (el && el.tagName === "IMG") {
          if (data.logo_url) el.src = data.logo_url;
        } else {
          setText(el, data.site_name);
        }
        break;
      case "header_cta":
        setText(el, data.header_cta_text);
        if (el && el.tagName === "A" && data.header_cta_url) el.href = data.header_cta_url;
        break;
      case "hero_eyebrow":
        setText(el, hero.eyebrow);
        break;
      case "hero_heading":
        setText(el, hero.heading);
        break;
      case "hero_subheading":
        setText(el, hero.subheading);
        break;
      case "hero_background":
        if (el && hero.background_image) el.style.backgroundImage = "url('" + hero.background_image + "')";
        break;
      case "hero_button":
        if (el && hero.buttons && hero.buttons[0]) {
          setText(el, hero.buttons[0].label);
          if (el.tagName === "A" && hero.buttons[0].url) el.href = hero.buttons[0].url;
        }
        break;
      case "footer_copyright":
        setText(el, data.footer_copyright);
        break;
      case "favicon":
        if (data.favicon_url) {
          var link = el && el.tagName === "LINK" ? el : document.querySelector('link[rel="icon"],link[rel="shortcut icon"]');
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = data.favicon_url;
        }
        break;
      case "cover_image":
        if (el && data.cover_image) {
          if (el.tagName === "IMG") el.src = data.cover_image;
          else el.style.backgroundImage = "url('" + data.cover_image + "')";
        }
        break;
      case "theme_colors":
        if (data.colors) {
          var root = document.documentElement;
          Object.keys(data.colors).forEach(function (name) {
            root.style.setProperty("--cms-" + name, data.colors[name]);
          });
        }
        break;
      default:
        break;
    }
  }

  function applyConfig(cfg) {
    if (!cfg || !cfg.data) return;
    var data = cfg.data;
    (cfg.mappings || []).forEach(function (m) {
      applyMapping(m, data);
    });
    if (data.custom_css && !document.querySelector("style[data-cms]")) {
      var style = document.createElement("style");
      style.setAttribute("data-cms", "1");
      style.textContent = data.custom_css;
      document.head.appendChild(style);
    }
    if (data.custom_js) {
      try {
        new Function(data.custom_js)();
      } catch (e) {
        if (window.console) console.warn("[cms] custom js error", e);
      }
    }
  }

  var site = findSite();
  if (!site) {
    if (window.console) console.warn("[cms] loader: no site key found");
    return;
  }
  fetch(site.origin + "/connector/v1/config/" + encodeURIComponent(site.key) + "/", {
    headers: { Accept: "application/json" },
  })
    .then(function (resp) {
      if (!resp.ok) throw new Error("config HTTP " + resp.status);
      return resp.json();
    })
    .then(applyConfig)
    .catch(function (e) {
      if (window.console) console.warn("[cms] loader:", e);
    });
})();
