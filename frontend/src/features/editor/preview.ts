import type { SiteConfigDraft } from "./types";

/** True when the working copy differs from the last saved draft. */
export function isDirty(saved: SiteConfigDraft, current: SiteConfigDraft): boolean {
  return JSON.stringify(saved) !== JSON.stringify(current);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

/** Build a standalone preview document from a draft config. */
export function configToHtml(cfg: SiteConfigDraft): string {
  const t = cfg.theme;
  const heroBtns = cfg.hero.buttons
    .map(
      (b) =>
        `<a href="${escapeHtml(b.url)}" style="display:inline-block;margin:4px;padding:10px 20px;border-radius:6px;text-decoration:none;${b.variant === "primary" ? `background:${escapeHtml(t.colors.primary)};color:#fff` : `border:1px solid ${escapeHtml(t.colors.primary)};color:${escapeHtml(t.colors.primary)}`}">${escapeHtml(b.label)}</a>`,
    )
    .join("");
  const nav = cfg.navigation.items
    .map((i) => `<a href="${escapeHtml(i.url)}" style="margin:0 10px;color:inherit;text-decoration:none">${escapeHtml(i.label)}</a>`)
    .join("");
  const footerCols = cfg.footer.columns
    .map(
      (c) =>
        `<div><h4>${escapeHtml(c.heading)}</h4>${c.links.map((l) => `<p><a href="${escapeHtml(l.url)}" style="color:inherit">${escapeHtml(l.label)}</a></p>`).join("")}</div>`,
    )
    .join("");
  const socials = Object.entries(cfg.social)
    .filter(([, v]) => v)
    .map(([k, v]) => `<a href="${escapeHtml(v)}" style="margin-right:10px;color:inherit">${escapeHtml(k)}</a>`)
    .join("");
  const align = cfg.hero.alignment === "left" ? "flex-start" : cfg.hero.alignment === "right" ? "flex-end" : "center";
  const textAlign = cfg.hero.alignment === "left" ? "left" : cfg.hero.alignment === "right" ? "right" : "center";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(cfg.seo.title || cfg.general.site_name)}</title>
<meta name="description" content="${escapeHtml(cfg.seo.description)}">
<style>body{margin:0;font-family:${escapeHtml(t.typography.body_font)};font-size:${Number(t.typography.base_size) || 16}px;color:${escapeHtml(t.colors.text)};background:${escapeHtml(t.colors.background)}}h1,h2,h3{font-family:${escapeHtml(t.typography.heading_font)}}${cfg.custom.css || ""}</style>
</head><body>
<header style="display:flex;align-items:center;justify-content:space-between;padding:12px 24px;border-bottom:1px solid #eee;${cfg.header.sticky ? "position:sticky;top:0;background:inherit;z-index:10" : ""}">
<div style="display:flex;align-items:center;gap:12px">${cfg.header.logo_url ? `<img src="${escapeHtml(cfg.header.logo_url)}" alt="logo" style="height:36px">` : `<strong>${escapeHtml(cfg.general.site_name)}</strong>`}</div>
<nav>${nav}</nav>
${cfg.header.cta_text ? `<a href="${escapeHtml(cfg.header.cta_url)}" style="background:${escapeHtml(t.colors.primary)};color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none">${escapeHtml(cfg.header.cta_text)}</a>` : ""}
</header>
${cfg.cover.image_url ? `<div><img src="${escapeHtml(cfg.cover.image_url)}" alt="cover" style="width:100%;max-height:320px;object-fit:cover"></div>` : ""}
<section style="position:relative;padding:80px 24px;text-align:${textAlign};${cfg.hero.background_image ? `background:url('${escapeHtml(cfg.hero.background_image)}') center/cover;` : `background:${escapeHtml(t.colors.background)}`}display:flex;flex-direction:column;align-items:${align}">
${cfg.hero.background_image ? `<div style="position:absolute;inset:0;background:#000;opacity:${Number(cfg.hero.overlay_opacity) || 0}"></div>` : ""}
<div style="position:relative;max-width:720px">
${cfg.hero.eyebrow ? `<p style="letter-spacing:2px;text-transform:uppercase;font-size:12px">${escapeHtml(cfg.hero.eyebrow)}</p>` : ""}
<h1 style="font-size:2.5em;margin:.3em 0">${escapeHtml(cfg.hero.heading)}</h1>
<p style="font-size:1.2em">${escapeHtml(cfg.hero.subheading)}</p>
<div style="margin-top:16px">${heroBtns}</div>
</div></section>
<footer style="padding:32px 24px;border-top:1px solid #eee;margin-top:32px">
<div style="display:flex;gap:32px;flex-wrap:wrap">${footerCols}</div>
<div style="margin-top:16px">${socials}</div>
${cfg.footer.show_newsletter ? `<form onsubmit="return false" style="margin-top:12px"><input placeholder="Email" style="padding:8px"><button style="padding:8px 12px">Subscribe</button></form>` : ""}
<p style="margin-top:16px;font-size:12px">${escapeHtml(cfg.footer.copyright)}</p>
</footer>
<script>${cfg.custom.js || ""}</script>
</body></html>`;
}
