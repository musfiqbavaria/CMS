import { describe, expect, it } from "vitest";
import { configToHtml, escapeHtml, isDirty } from "./preview";
import type { SiteConfigDraft } from "./types";

const base: SiteConfigDraft = {
  general: { site_name: "Acme", tagline: "Hi" },
  header: { logo_url: "", layout: "left", sticky: true, cta_text: "", cta_url: "" },
  footer: { columns: [], copyright: "© Acme", show_newsletter: false },
  branding: { logo_url: "", favicon_url: "" },
  cover: { image_url: "", overlay_opacity: 0.4 },
  hero: {
    eyebrow: "",
    heading: "Welcome",
    subheading: "Sub",
    background_image: "",
    alignment: "center",
    overlay_opacity: 0.5,
    buttons: [{ label: "Go", url: "/", variant: "primary" }],
  },
  navigation: { items: [{ label: "Home", url: "/" }] },
  theme: {
    colors: { primary: "#111111", secondary: "#222222", background: "#ffffff", text: "#000000" },
    typography: { heading_font: "system-ui", body_font: "system-ui", base_size: 16 },
  },
  seo: { title: "", description: "", keywords: "", og_image: "" },
  custom: { css: "", js: "" },
  social: { facebook: "", x: "", instagram: "", linkedin: "", youtube: "" },
};

describe("editor preview utils", () => {
  it("detects dirty drafts", () => {
    expect(isDirty(base, base)).toBe(false);
    expect(isDirty(base, { ...base, hero: { ...base.hero, heading: "Changed" } })).toBe(true);
  });

  it("escapes user text in preview html", () => {
    expect(escapeHtml("<b>&\"'")).toBe("&lt;b&gt;&amp;&quot;&#39;");
    const html = configToHtml({ ...base, hero: { ...base.hero, heading: "<script>alert(1)</script>" } });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Acme");
  });

  it("renders hero heading and nav", () => {
    const html = configToHtml(base);
    expect(html).toContain("Welcome");
    expect(html).toContain("Home");
    expect(html).toContain("#111111");
  });
});
