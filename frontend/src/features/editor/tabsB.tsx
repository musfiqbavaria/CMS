import type { Control } from "react-hook-form";
import { Controller, useFieldArray } from "react-hook-form";
import { Color, ImageField, LinkList, Num, Select, Text, TextArea } from "./components/fields";
import type { SiteConfigDraft } from "./types";

type C = Control<SiteConfigDraft>;

export function HeroTab({ control, siteId }: { control: C; siteId: number }) {
  const { fields, append, remove } = useFieldArray({ control, name: "hero.buttons" });
  return (
    <div className="space-y-3">
      <Text label="Eyebrow" name="hero.eyebrow" control={control} placeholder="NEW" />
      <Text label="Heading" name="hero.heading" control={control} />
      <TextArea label="Subheading" name="hero.subheading" control={control} />
      <ImageField label="Background image" name="hero.background_image" control={control} siteId={siteId} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Alignment" name="hero.alignment" control={control} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} />
        <Num label="Overlay opacity (0–1)" name="hero.overlay_opacity" control={control} min={0} max={1} step={0.05} />
      </div>
      <div className="text-sm">
        <span className="font-medium">Buttons</span>
        <ul className="mt-1 space-y-2">
          {fields.map((f, i) => (
            <li key={f.id} className="flex items-center gap-1 rounded border p-2 dark:border-slate-700">
              <Controller name={`hero.buttons.${i}.label`} control={control} render={({ field }) => <input {...field} value={field.value ?? ""} placeholder="Label" className="w-1/3 rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700" />} />
              <Controller name={`hero.buttons.${i}.url`} control={control} render={({ field }) => <input {...field} value={field.value ?? ""} placeholder="/url" className="flex-1 rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700" />} />
              <Controller name={`hero.buttons.${i}.variant`} control={control} render={({ field }) => (
                <select value={field.value ?? "primary"} onChange={field.onChange} className="rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700">
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
              )} />
              <button type="button" onClick={() => remove(i)} aria-label="Remove button" className="rounded border border-red-300 px-1.5 text-red-600">✕</button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => append({ label: "", url: "/", variant: "primary" })} className="mt-2 rounded border px-2 py-1 text-xs dark:border-slate-600">
          + Add button
        </button>
      </div>
    </div>
  );
}

export function NavTab({ control }: { control: C }) {
  return (
    <div className="space-y-3">
      <LinkList label="Menu items (reorder with ↑ ↓)" name="navigation.items" control={control} />
    </div>
  );
}

export function ThemeTab({ control }: { control: C }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Color label="Primary" name="theme.colors.primary" control={control} />
        <Color label="Secondary" name="theme.colors.secondary" control={control} />
        <Color label="Background" name="theme.colors.background" control={control} />
        <Color label="Text" name="theme.colors.text" control={control} />
      </div>
      <Text label="Heading font" name="theme.typography.heading_font" control={control} />
      <Text label="Body font" name="theme.typography.body_font" control={control} />
      <Num label="Base font size (px)" name="theme.typography.base_size" control={control} min={12} max={24} step={1} />
    </div>
  );
}

export function CustomTab({ control }: { control: C }) {
  return (
    <div className="space-y-3">
      <TextArea label="Custom CSS" name="custom.css" control={control} rows={8} mono />
      <TextArea label="Custom JS" name="custom.js" control={control} rows={8} mono />
      <p className="text-xs text-slate-500">Admin-authored only. Served to the verified site on publish.</p>
    </div>
  );
}

export function SocialTab({ control }: { control: C }) {
  return (
    <div className="space-y-3">
      {(["facebook", "x", "instagram", "linkedin", "youtube"] as const).map((net) => (
        <Text key={net} label={net === "x" ? "X (Twitter) URL" : `${net[0].toUpperCase()}${net.slice(1)} URL`} name={`social.${net}`} control={control} placeholder="https://" />
      ))}
      <p className="text-xs text-slate-500">Set URLs appear as footer links in the preview and connector output.</p>
    </div>
  );
}
