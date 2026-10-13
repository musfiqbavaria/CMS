import { useState } from "react";
import { SECTION_TYPE_MAP } from "../sectionTypes";
import type { Section } from "../types";

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function parseJson(text: string): { ok: boolean; value: unknown; error?: string } {
  try {
    return { ok: true, value: JSON.parse(text || "null") };
  } catch (e) {
    return { ok: false, value: null, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

/** Editable section card: dynamic fields per type + HTML5 drag reorder + enable toggle. */
export default function SectionCard({
  section,
  onSave,
  onDelete,
  onMove,
  onDragStart,
  onDrop,
  saving,
}: {
  section: Section;
  onSave: (patch: { settings?: Record<string, unknown>; enabled?: boolean }) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onDragStart: () => void;
  onDrop: () => void;
  saving: boolean;
}) {
  const def = SECTION_TYPE_MAP[section.type];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (def?.fields ?? []).map((f) => {
        const v = (section.settings as Record<string, unknown>)[f.key];
        if (f.kind === "stringlist") return [f.key, Array.isArray(v) ? (v as string[]).join("\n") : ""];
        if (f.kind === "json") return [f.key, JSON.stringify(v ?? (f.key === "count" ? 0 : f.key === "items" || f.key === "plans" || f.key === "images" ? [] : ""), null, 1)];
        if (f.kind === "number" || f.kind === "toggle") return [f.key, String(v ?? (f.kind === "number" ? 0 : false))];
        return [f.key, v === undefined || v === null ? "" : String(v)];
      }),
    ),
  );
  const [error, setError] = useState<string | null>(null);

  function set(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    const out: Record<string, unknown> = {};
    for (const f of def?.fields ?? []) {
      const raw = values[f.key] ?? "";
      if (f.kind === "number") out[f.key] = Number(raw) || 0;
      else if (f.kind === "toggle") out[f.key] = raw === "true";
      else if (f.kind === "stringlist") out[f.key] = raw.split("\n").map((s) => s.trim()).filter(Boolean);
      else if (f.kind === "json") {
        const parsed = parseJson(raw);
        if (!parsed.ok) {
          setError(`${f.label}: ${parsed.error}`);
          return;
        }
        out[f.key] = parsed.value;
      } else out[f.key] = raw;
    }
    setError(null);
    onSave({ settings: out });
  }

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={`rounded border bg-white p-3 dark:border-slate-700 dark:bg-slate-800 ${section.enabled ? "" : "opacity-60"}`}
    >
      <div className="flex items-center gap-2">
        <span title="Drag to reorder" className="cursor-grab text-slate-400">⠿</span>
        <strong className="text-sm">{def?.label ?? section.type}</strong>
        <span className="ml-auto flex gap-1">
          <button onClick={() => onMove(-1)} aria-label="Move up" className="rounded border px-1.5 text-xs dark:border-slate-600">↑</button>
          <button onClick={() => onMove(1)} aria-label="Move down" className="rounded border px-1.5 text-xs dark:border-slate-600">↓</button>
          <button onClick={() => onSave({ enabled: !section.enabled })} className="rounded border px-1.5 text-xs dark:border-slate-600">
            {section.enabled ? "Disable" : "Enable"}
          </button>
          <button onClick={onDelete} aria-label="Delete section" className="rounded border border-red-300 px-1.5 text-xs text-red-600">✕</button>
        </span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {(def?.fields ?? []).map((f) => (
          <label key={f.key} className={`block text-xs ${f.kind === "textarea" || f.kind === "json" ? "sm:col-span-2" : ""}`}>
            <span className="font-medium">{f.label}</span>
            {f.kind === "textarea" || f.kind === "json" ? (
              <textarea value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} rows={f.kind === "json" ? 4 : 2} className="mt-1 w-full rounded border p-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-700" />
            ) : f.kind === "number" ? (
              <input type="number" value={values[f.key] ?? "0"} onChange={(e) => set(f.key, e.target.value)} className="mt-1 w-full rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700" />
            ) : f.kind === "toggle" ? (
              <select value={values[f.key] ?? "false"} onChange={(e) => set(f.key, e.target.value)} className="mt-1 w-full rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700">
                <option value="true">On</option>
                <option value="false">Off</option>
              </select>
            ) : f.kind === "color" ? (
              <input type="color" value={values[f.key] || "#000000"} onChange={(e) => set(f.key, e.target.value)} className="mt-1 h-8 w-full rounded border dark:border-slate-600" />
            ) : f.kind === "select" ? (
              <select value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className="mt-1 w-full rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700">
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} placeholder={f.placeholder} className="mt-1 w-full rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700" />
            )}
          </label>
        ))}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      <button onClick={save} disabled={saving} className="mt-2 rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50">
        {saving ? "Saving…" : "Save section"}
      </button>
    </li>
  );
}
