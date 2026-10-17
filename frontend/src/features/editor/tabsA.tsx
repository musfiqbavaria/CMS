import type { Control } from "react-hook-form";
import { useController, useFieldArray, useWatch } from "react-hook-form";
import { Controller } from "react-hook-form";
import { ImageField, LinkList, Num, Select, Text, TextArea, Toggle } from "./components/fields";
import type { SiteConfigDraft } from "./types";

type C = Control<SiteConfigDraft>;

export function GeneralTab({ control, seededTitle }: { control: C; seededTitle?: string }) {
  const { field: title } = useController({ control, name: "seo.title" });
  const overrides = useWatch({ control, name: "_overrides" }) ?? [];
  return (
    <div className="space-y-3">
      <Text label="Site name" name="general.site_name" control={control} onValueChange={(value, previous) => { if (!title.value || title.value === previous || (title.value === seededTitle && !overrides.includes("seo.title"))) title.onChange(value); }} />
      <Text label="Tagline" name="general.tagline" control={control} />
    </div>
  );
}

export function HeaderTab({ control, siteId }: { control: C; siteId: number }) {
  return (
    <div className="space-y-3">
      <ImageField label="Header logo (same image as Logo & Favicon)" name="branding.logo_url" control={control} siteId={siteId} />
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
    <div className="space-y-3" data-editor-field="footer.columns">
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
      <p className="text-xs text-slate-500">This toggles an existing newsletter form mapped on your website. Subscription delivery stays with your website's form provider.</p>
    </div>
  );
}

export function BrandingTab({ control, siteId }: { control: C; siteId: number }) {
  return (
    <div className="space-y-3">
      <ImageField label="Logo" name="branding.logo_url" control={control} siteId={siteId} />
      <ImageField label="Favicon" name="branding.favicon_url" control={control} siteId={siteId} />
      <p className="text-xs text-slate-500">Choose an image for each field, then publish. Uploading to the library alone does not select a logo or favicon. Square PNG works best for favicons.</p>
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
  const { field: overrides } = useController({ control, name: "_overrides" });
  return (
    <div className="space-y-3">
      <Text label="Meta title" name="seo.title" control={control} onValueChange={() => { if (!overrides.value?.includes("seo.title")) overrides.onChange([...(overrides.value ?? []), "seo.title"]); }} />
      <p className="text-xs text-slate-500">The browser-tab title uses this value, or the site name when blank. The default title follows site-name edits; a custom title is preserved.</p>
      <TextArea label="Meta description" name="seo.description" control={control} />
      <Text label="Keywords (comma separated)" name="seo.keywords" control={control} />
      <ImageField label="OG image" name="seo.og_image" control={control} siteId={siteId} />
    </div>
  );
}
