export interface Theme {
  id: number;
  name: string;
  slug: string;
  description: string;
  settings: { colors?: Record<string, string>; fonts?: Record<string, string>; [k: string]: unknown };
  is_builtin: boolean;
}

export interface Page {
  id: number;
  site: number;
  title: string;
  slug: string;
  status: "draft" | "published";
  seo: { title?: string; description?: string };
  sections_count: number;
}

export interface Section {
  id: number;
  page: number;
  type: string;
  position: number;
  settings: Record<string, unknown>;
  enabled: boolean;
}

export interface Category {
  id: number;
  site: number;
  name: string;
  slug: string;
}

export interface Tag {
  id: number;
  site: number;
  name: string;
  slug: string;
}

export interface Post {
  id: number;
  site: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: "draft" | "published";
  seo: { title?: string; description?: string };
  category: number | null;
  category_name: string | null;
  tags: string[];
  published_at: string | null;
}

export interface Menu {
  id: number;
  site: number;
  name: string;
  slug: string;
  items: MenuItem[];
}

export interface MenuItem {
  id: number;
  menu: number;
  label: string;
  url: string;
  position: number;
}

export interface Product {
  id: number;
  site: number;
  name: string;
  slug: string;
  description: string;
  price: string;
  compare_at: string | null;
  stock: number;
  status: "draft" | "published";
  images: string[];
  variants: { name: string; price_delta?: string; stock?: number }[];
  category: number | null;
  category_name: string | null;
}
