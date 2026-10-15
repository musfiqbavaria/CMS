import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCreateMapping, useDeleteMapping, useMappings, useResetMappings, useUpdateMapping } from "../api";
import { useSite } from "../../sites/api";
import { Card, CardTitle, Skeleton, PageHeader } from "../../../shared/ui/kit";

export default function MappingsPage() {
  const { id } = useParams();
  const siteId = Number(id);
  const validId = Number.isFinite(siteId) ? siteId : null;
  const { data: site } = useSite(validId);
  const { data: mappings, isLoading } = useMappings(validId);
  const create = useCreateMapping(siteId);
  const update = useUpdateMapping(siteId);
  const remove = useDeleteMapping(siteId);
  const reset = useResetMappings(siteId);
  const [key, setKey] = useState("site_logo");
  const [selector, setSelector] = useState("");
  const [error, setError] = useState<string | null>(null);

  const usedKeys = new Set((mappings ?? []).map((m) => m.key));

  function add() {
    setError(null);
    if (!selector.trim()) {
      setError("Selector is required.");
      return;
    }
    create.mutate(
      { key, selector: selector.trim() },
      { onSuccess: () => setSelector(""), onError: () => setError("Could not add mapping (duplicate key?).") },
    );
  }

  if (isLoading) return <Skeleton className="h-48" />;
  if (!site) {
    return (
      <Card>
        <p className="text-sm text-red-600">Site not found.</p>
        <Link to="/websites" className="text-sm underline">Back to Websites</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/websites" className="text-sm text-slate-500 underline">← Websites</Link>
        <PageHeader title="Content connections" eyebrow="Selector mappings" description={site.domain} />
        <p className="mt-1 text-sm text-slate-500">
          Each row maps one published value onto the visitor’s page. Prefer stable hooks like{" "}
          <code>[data-cms="hero-heading"]</code> over fragile theme classes.
        </p>
      </div>

      {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <Card>
        <CardTitle>Add mapping</CardTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          <select value={key} onChange={(e) => setKey(e.target.value)} className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700">
            {["site_logo", "header_cta", "hero_eyebrow", "hero_heading", "hero_subheading", "hero_background", "hero_button", "footer_copyright", "favicon", "cover_image", "theme_colors"]
              .filter((k) => !usedKeys.has(k))
              .map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
          </select>
          <input value={selector} onChange={(e) => setSelector(e.target.value)} placeholder='CSS selector, e.g. header img or [data-cms="logo"]' className="min-w-64 flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700" />
          <button onClick={add} disabled={create.isPending} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">
            Add
          </button>
          <button onClick={() => reset.mutate()} disabled={reset.isPending} className="rounded border px-3 py-2 text-sm dark:border-slate-600">
            Reset defaults
          </button>
        </div>
      </Card>

      <Card>
        <CardTitle>Active mappings</CardTitle>
        <ul className="mt-2 space-y-2">
          {(mappings ?? []).map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm dark:border-slate-700">
              <span className="w-36 font-medium">{m.key_label}</span>
              <input
                defaultValue={m.selector}
                key={`${m.id}-${m.selector}`}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== m.selector) {
                    update.mutate({ id: m.id, selector: e.target.value.trim() });
                  }
                }}
                className="min-w-48 flex-1 rounded border p-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-700"
              />
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={m.enabled} onChange={(e) => update.mutate({ id: m.id, enabled: e.target.checked })} />
                Enabled
              </label>
              <button onClick={() => remove.mutate(m.id)} className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600">
                Delete
              </button>
            </li>
          ))}
          {(mappings ?? []).length === 0 && <li className="text-sm text-slate-500">No mappings — reset to defaults to start.</li>}
        </ul>
      </Card>
    </div>
  );
}
