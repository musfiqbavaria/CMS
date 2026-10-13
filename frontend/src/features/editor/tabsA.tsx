import type { Control } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { Controller } from "react-hook-form";
import { ImageField, LinkList, Num, Select, Text, TextArea, Toggle } from "./components/fields";
import type { SiteConfigDraft } from "./types";

type C = Control<SiteConfigDraft>;

export function GeneralTab({ control }: { control: C }) {
  return (
    <div className="space-y-3">
      <Text label="Site name" name="general.site_name" control={control} />
      <Text label="Tagline" name="general.tagline" control={control} />
    </div>
  );
}

export function HeaderTab({ control, siteId }: { control: C; siteId: number }) {
  return (
    <div className="space-y-3">
      <ImageField label="Header logo (falls back to site name)" name="header.logo_url" control={control} siteId={siteId} />
      <Select label="Layout" name="header.layout" control={control} options={[{ value: "left", label: "Logo left" }, { value: "center", label: "Logo centered" }]} />
      <Toggle label="Sticky header" name="header.sticky" control={control} />
      <Text label="CTA button text" name="header.cta_text" control={control} placeholder="Get started" />
      <Text label="CTA button URL" name="header.cta_url" control={control} placeholder="/contact" />
    </div>
  );
}

export function FooterTab({ control }: { control: C }) {
  const { fields, append, remove } = useFieldArray({ control, name: "footer.columns" });
  return (
    <div className="space-y-3">
      {fields.map((col, i) => (
        <div key={col.id} className="rounded border p-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Controller
              name={`footer.columns.${i}.heading`}
              control={control}
              render={({ field }) => <input {...field} value={field.value ?? ""} placeholder="Column heading" className="flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700" />}
            />
            <button type="button" onClick={() => remove(i)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600">Remove column</button>
          </div>
          <div className="mt-2">
            <LinkList label="Links" name={`footer.columns.${i}.links`} control={control} />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => append({ heading: "", links: [] })} className="rounded border px-2 py-1 text-xs dark:border-slate-600">
        + Add column
      </button>
      <Text label="Copyright line" name="footer.copyright" control={control} />
      <Toggle label="Show newsletter box" name="footer.show_newsletter" control={control} />
    </div>
  );
}

export function BrandingTab({ control, siteId }: { control: C; siteId: number }) {
  return (
    <div className="space-y-3">
      <ImageField label="Logo" name="branding.logo_url" control={control} siteId={siteId} />
      <ImageField label="Favicon" name="branding.favicon_url" control={control} siteId={siteId} />
      <p className="text-xs text-slate-500">Square PNG works best for favicons. The connector applies these to the live site on publish (Phase 6).</p>
    </div>
  );
}

export function CoverTab({ control, siteId }: { control: C; siteId: number }) {
  return (
    <div className="space-y-3">
      <ImageField label="Cover image" name="cover.image_url" control={control} siteId={siteId} />
      <Num label="Overlay opacity (0–1)" name="cover.overlay_opacity" control={control} min={0} max={1} step={0.05} />
    </div>
  );
}

export function SeoTab({ control, siteId }: { control: C; siteId: number }) {
  return (
    <div className="space-y-3">
      <Text label="Meta title" name="seo.title" control={control} />
      <TextArea label="Meta description" name="seo.description" control={control} />
      <Text label="Keywords (comma separated)" name="seo.keywords" control={control} />
      <ImageField label="OG image" name="seo.og_image" control={control} siteId={siteId} />
    </div>
  );
}
