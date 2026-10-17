import type { EditorTabKey } from "./types";
import { escapeHtml } from "./preview";

export const EDIT_TARGETS = {
  site_name: { section: "general", field: "general.site_name", label: "Site name" },
  site_tagline: { section: "general", field: "general.tagline", label: "Tagline" },
  site_logo: { section: "branding", field: "branding.logo_url", label: "Logo" },
  header_settings: { section: "header", field: "header.layout", label: "Header" },
  header_cta: { section: "header", field: "header.cta_text", label: "Header button" },
  navigation: { section: "navigation", field: "navigation.items", label: "Navigation menu" },
  hero_eyebrow: { section: "hero", field: "hero.eyebrow", label: "Hero eyebrow" },
  hero_heading: { section: "hero", field: "hero.heading", label: "Hero heading" },
  hero_subheading: { section: "hero", field: "hero.subheading", label: "Hero subheading" },
  hero_background: { section: "hero", field: "hero.background_image", label: "Hero background" },
  hero_button: { section: "hero", field: "hero.buttons", label: "Hero buttons" },
  hero_buttons: { section: "hero", field: "hero.buttons", label: "Hero buttons" },
  footer_copyright: { section: "footer", field: "footer.copyright", label: "Copyright" },
  footer_columns: { section: "footer", field: "footer.columns", label: "Footer links" },
  footer_newsletter: { section: "footer", field: "footer.show_newsletter", label: "Newsletter" },
  social_links: { section: "social", field: "social.facebook", label: "Social links" },
  favicon: { section: "branding", field: "branding.favicon_url", label: "Favicon" },
  cover_image: { section: "cover", field: "cover.image_url", label: "Cover image" },
  theme_colors: { section: "theme", field: "theme.colors.primary", label: "Colors & typography" },
} as const satisfies Record<string, { section: EditorTabKey; field: string; label: string }>;

export type EditTargetKey = keyof typeof EDIT_TARGETS;

export function isEditTarget(key: unknown): key is EditTargetKey {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(EDIT_TARGETS, key);
}

/** Per-page text areas use ids like "b1a2b3c4d5e6f708". */
const PAGE_BLOCK_KEY = /^b[0-9a-f]{8,24}$/;

export function isPageBlockKey(key: unknown): key is string {
  return typeof key === "string" && PAGE_BLOCK_KEY.test(key);
}

export function newPageBlockId(): string {
  return "b" + Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export interface PageBlockSuggestion {
  path: string;
  selector: string;
  label: string;
}

function blockSuggestion(message: Record<string, unknown>): PageBlockSuggestion | null {
  const { path, selector, label } = message;
  if (typeof path !== "string" || !/^\/[^\s?#]{0,200}$/.test(path)) return null;
  if (typeof selector !== "string" || selector.length === 0 || selector.length > 255) return null;
  return { path, selector, label: typeof label === "string" ? label.replace(/\s+/g, " ").slice(0, 80) : "" };
}

export function isCmsPreview(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && /^\/connector\/v1\/preview\/[^/]+\/$/.test(parsed.pathname);
  } catch { return false; }
}

export function liveEditUrl(url: string, channel: string): string {
  const parsed = new URL(url, window.location.origin);
  parsed.searchParams.set("edit_channel", channel);
  return parsed.href;
}

/** The frame is opaque-origin. Communicate only through its own signed-in parent window. */
export function editableDraft(html: string, channel: string): string {
  if (!html) return html;
  const config = {
    channel,
    parentOrigin: window.location.origin,
    targets: Object.entries(EDIT_TARGETS).map(([key, target]) => ({ key, label: target.label, selector: `[data-cms-edit="${key}"]` })),
  };
  const script = `<script src="${escapeHtml(window.location.origin)}/connector/v1/editor-bridge.js" data-cms-editor-config="${escapeHtml(JSON.stringify(config))}"></script>`;
  return html.replace(/<head\b[^>]*>/i, (head) => head + script);
}

export function editorMessage(event: MessageEvent, frame: Window | null, channel: string) {
  if (!frame || event.source !== frame || event.origin !== "null") return null;
  const data: unknown = event.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const message = data as Record<string, unknown>;
  if (message.channel !== channel) return null;
  if (message.type === "cms:editor:select" && (isEditTarget(message.key) || isPageBlockKey(message.key))) return { type: "select" as const, key: message.key };
  if (message.type === "cms:editor:ready" && Number.isInteger(message.count) && Number(message.count) >= 0 && Number(message.count) <= 10_000) {
    const usable = typeof message.path === "string" && /^\/[^\s?#]{0,200}$/.test(message.path) && !message.path.startsWith("/connector/");
    return { type: "ready" as const, count: Number(message.count), path: usable ? (message.path as string) : "/" };
  }
  if (message.type === "cms:editor:unmapped") return { type: "unmapped" as const, suggestion: blockSuggestion(message) };
  if (message.type === "cms:editor:scroll" && typeof message.y === "number" && Number.isFinite(message.y) && message.y >= 0 && message.y <= 10_000_000) return { type: "scroll" as const, y: message.y };
  return null;
}
