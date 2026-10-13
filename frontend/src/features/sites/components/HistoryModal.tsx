import { useSiteLogs } from "../api";
import type { Site } from "../types";

function diffRows(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map((k) => ({ key: k, from: before[k], to: after[k] }));
}

export default function HistoryModal({ site, onClose }: { site: Site | null; onClose: () => void }) {
  const { data, isLoading } = useSiteLogs(site?.id ?? null);
  if (!site) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 className="text-lg font-bold">History — {site.domain}</h2>
        {isLoading && <p className="mt-3 text-sm text-slate-500">Loading audit log…</p>}
        {data && data.results.length === 0 && <p className="mt-3 text-sm text-slate-500">No entries.</p>}
        {data && (
          <ul className="mt-3 space-y-3">
            {data.results.map((e) => (
              <li key={e.id} className="rounded border p-3 text-sm dark:border-slate-700">
                <p>
                  <strong className="capitalize">{e.action}</strong> by {e.actor_username ?? "system"} ·{" "}
                  {new Date(e.created_at).toLocaleString()}
                </p>
                {diffRows(e.before, e.after).map((d) => (
                  <p key={d.key} className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">
                    {d.key}: {JSON.stringify(d.from)} → {JSON.stringify(d.to)}
                  </p>
                ))}
                {e.action === "deleted" && (
                  <p className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">
                    snapshot retained for {e.site_display}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end pt-4">
          <button onClick={onClose} className="rounded border px-4 py-2 text-sm dark:border-slate-600">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
