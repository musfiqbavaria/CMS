export interface LinkItem {
  label: string;
  url: string;
}

export interface HeroButton extends LinkItem {
  variant: string;
}

export interface FooterColumn {
  heading: string;
  links: LinkItem[];
}

export interface SiteConfigDraft {
  _overrides?: string[];
  general: { site_name: string; tagline: string };
  header: { logo_url: string; layout: string; sticky: boolean; cta_text: string; cta_url: string };
  footer: { columns: FooterColumn[]; copyright: string; show_newsletter: boolean };
  branding: { logo_url: string; favicon_url: string };
  cover: { image_url: string; overlay_opacity: number };
  hero: {
    eyebrow: string;
    heading: string;
    subheading: string;
    background_image: string;
    alignment: string;
    overlay_opacity: number;
    buttons: HeroButton[];
  };
  navigation: { items: LinkItem[] };
  theme: {
    colors: { primary: string; secondary: string; background: string; text: string };
    typography: { heading_font: string; body_font: string; base_size: number };
  };
  seo: { title: string; description: string; keywords: string; og_image: string };
  custom: { css: string; js: string };
  social: { facebook: string; x: string; instagram: string; linkedin: string; youtube: string };
}

export interface ConfigVersion {
  id: number;
  site: number;
  version_no: number;
  snapshot: SiteConfigDraft;
  status: "draft" | "published" | "archived";
  author: number | null;
  author_username: string | null;
  note: string;
  created_at: string;
}

export interface EditorConfig {
  id: number;
  site: number;
  draft: SiteConfigDraft;
  published: Partial<SiteConfigDraft>;
  published_version: number | null;
  published_version_no: number | null;
  updated_at: string;
}

export interface MediaAsset {
  id: number;
  site: number | null;
  file: string;
  url: string;
  alt: string;
  width: number;
  height: number;
  size: number;
  uploaded_by_username: string | null;
  created_at: string;
}

export const EDITOR_TABS = [
  { key: "general", label: "General" },
  { key: "header", label: "Header" },
  { key: "footer", label: "Footer" },
  { key: "branding", label: "Logo & Favicon" },
  { key: "cover", label: "Cover" },
  { key: "hero", label: "Hero Section" },
  { key: "navigation", label: "Navigation Menu" },
  { key: "theme", label: "Colors & Typography" },
  { key: "seo", label: "SEO / Meta" },
  { key: "custom", label: "Custom CSS/JS" },
  { key: "social", label: "Social Links" },
  { key: "advanced", label: "Advanced" },
] as const;

export type EditorTabKey = (typeof EDITOR_TABS)[number]["key"];
