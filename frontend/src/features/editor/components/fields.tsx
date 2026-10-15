import type { Control, FieldValues, Path } from "react-hook-form";
import { Controller, useFieldArray } from "react-hook-form";
import { useState } from "react";
import MediaPicker from "./MediaPicker";

export function Text<T extends FieldValues>({ label, name, control, placeholder, onValueChange }: { label: string; name: Path<T>; control: Control<T>; placeholder?: string; onValueChange?: (value: string, previous: unknown) => void }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input {...field} value={field.value ?? ""} onChange={(event) => { onValueChange?.(event.target.value, field.value); field.onChange(event); }} placeholder={placeholder} className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
        )}
      />
    </label>
  );
}

export function TextArea<T extends FieldValues>({ label, name, control, rows = 3, mono }: { label: string; name: Path<T>; control: Control<T>; rows?: number; mono?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <textarea {...field} value={field.value ?? ""} rows={rows} className={`mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700 ${mono ? "font-mono text-xs" : ""}`} />
        )}
      />
    </label>
  );
}

export function Num<T extends FieldValues>({ label, name, control, min = 0, max = 100, step = 1 }: { label: string; name: Path<T>; control: Control<T>; min?: number; max?: number; step?: number }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input type="number" min={min} max={max} step={step} value={field.value ?? 0} onChange={(e) => field.onChange(Number(e.target.value))} className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
        )}
      />
    </label>
  );
}

export function Color<T extends FieldValues>({ label, name, control }: { label: string; name: Path<T>; control: Control<T> }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <span className="mt-1 flex items-center gap-2">
            <input type="color" value={field.value || "#000000"} onChange={field.onChange} className="h-9 w-12 rounded border dark:border-slate-600" />
            <input value={field.value ?? ""} onChange={field.onChange} className="w-full rounded border p-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-700" />
          </span>
        )}
      />
    </label>
  );
}

export function Toggle<T extends FieldValues>({ label, name, control }: { label: string; name: Path<T>; control: Control<T> }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <input type="checkbox" checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} className="h-4 w-4" />
        )}
      />
      <span className="font-medium">{label}</span>
    </label>
  );
}

export function Select<T extends FieldValues>({ label, name, control, options }: { label: string; name: Path<T>; control: Control<T>; options: { value: string; label: string }[] }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <select {...field} value={field.value ?? ""} className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700">
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      />
    </label>
  );
}

export function ImageField<T extends FieldValues>({ label, name, control, siteId }: { label: string; name: Path<T>; control: Control<T>; siteId: number }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div className="text-sm">
      <span className="font-medium">{label}</span>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <div className="mt-1 flex items-center gap-3">
            {field.value ? (
              <img src={String(field.value)} alt="preview" className="h-12 max-w-32 rounded border object-contain dark:border-slate-600" />
            ) : (
              <span className="flex h-12 w-24 items-center justify-center rounded border border-dashed text-xs text-slate-400">none</span>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setPickerOpen(true)} className="rounded border px-2 py-1 text-xs dark:border-slate-600">Choose…</button>
              {field.value && (
                <button type="button" onClick={() => field.onChange("")} className="rounded border px-2 py-1 text-xs dark:border-slate-600">Clear</button>
              )}
            </div>
            {pickerOpen && (
              <MediaPicker
                siteId={siteId}
                onSelect={(url) => {
                  field.onChange(url);
                  setPickerOpen(false);
                }}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>
        )}
      />
    </div>
  );
}

/** Ordered list of label/url rows with add/remove/move. Reorder via up/down buttons. */
export function LinkList<T extends FieldValues>({ label, name, control }: { label: string; name: Path<T>; control: Control<T> }) {
  const { fields, append, remove, move } = useFieldArray({ control, name: name as never });
  return (
    <div className="text-sm">
      <span className="font-medium">{label}</span>
      <ul className="mt-1 space-y-2">
        {fields.map((f, i) => (
          <li key={f.id} className="flex items-center gap-1 rounded border p-2 dark:border-slate-700">
            <Controller
              name={`${name}.${i}.label` as Path<T>}
              control={control}
              render={({ field }) => <input {...field} value={field.value ?? ""} placeholder="Label" className="w-1/3 rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700" />}
            />
            <Controller
              name={`${name}.${i}.url` as Path<T>}
              control={control}
              render={({ field }) => <input {...field} value={field.value ?? ""} placeholder="/url" className="flex-1 rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700" />}
            />
            <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up" className="rounded border px-1.5 disabled:opacity-30 dark:border-slate-600">↑</button>
            <button type="button" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down" className="rounded border px-1.5 disabled:opacity-30 dark:border-slate-600">↓</button>
            <button type="button" onClick={() => remove(i)} aria-label="Remove" className="rounded border border-red-300 px-1.5 text-red-600">✕</button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => append({ label: "", url: "/" } as never)} className="mt-2 rounded border px-2 py-1 text-xs dark:border-slate-600">
        + Add item
      </button>
    </div>
  );
}
