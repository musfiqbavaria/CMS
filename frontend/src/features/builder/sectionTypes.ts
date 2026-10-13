export type FieldKind = "text" | "textarea" | "number" | "toggle" | "color" | "image" | "select" | "stringlist" | "json";

export interface SectionField {
  key: string;
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface SectionTypeDef {
  type: string;
  label: string;
  fields: SectionField[];
}

/** Mirrors backend Section.TYPES. The renderer reads the same keys. */
export const SECTION_TYPES: SectionTypeDef[] = [
  {
    type: "hero",
    label: "Hero",
    fields: [
      { key: "heading", label: "Heading", kind: "text" },
      { key: "subheading", label: "Subheading", kind: "textarea" },
      { key: "background", label: "Background color", kind: "color" },
      { key: "primary_label", label: "Primary button", kind: "text" },
      { key: "primary_url", label: "Primary URL", kind: "text", placeholder: "/" },
    ],
  },
  {
    type: "features",
    label: "Features",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "items", label: "Items (JSON: [{title, text}])", kind: "json" },
    ],
  },
  {
    type: "gallery",
    label: "Gallery",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "images", label: "Image URLs (one per line)", kind: "stringlist" },
    ],
  },
  {
    type: "testimonials",
    label: "Testimonials",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "items", label: "Items (JSON: [{text, author}])", kind: "json" },
    ],
  },
  {
    type: "pricing",
    label: "Pricing",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "plans", label: "Plans (JSON: [{name, price, blurb}])", kind: "json" },
    ],
  },
  {
    type: "faq",
    label: "FAQ",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "items", label: "Items (JSON: [{q, a}])", kind: "json" },
    ],
  },
  {
    type: "contact",
    label: "Contact info",
    fields: [
      { key: "email", label: "Email", kind: "text" },
      { key: "phone", label: "Phone", kind: "text" },
      { key: "address", label: "Address", kind: "textarea" },
    ],
  },
  {
    type: "blog_list",
    label: "Blog list",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "count", label: "Posts to show", kind: "number" },
    ],
  },
  {
    type: "product_grid",
    label: "Product grid",
    fields: [
      { key: "title", label: "Title", kind: "text" },
      { key: "count", label: "Products to show", kind: "number" },
      { key: "category", label: "Category slug (empty = all)", kind: "text" },
    ],
  },
  {
    type: "custom_html",
    label: "Custom HTML",
    fields: [{ key: "html", label: "HTML (admin-authored)", kind: "textarea" }],
  },
];

export const SECTION_TYPE_MAP: Record<string, SectionTypeDef> = Object.fromEntries(
  SECTION_TYPES.map((t) => [t.type, t]),
);
