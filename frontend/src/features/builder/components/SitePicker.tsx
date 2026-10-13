import { Link } from "react-router-dom";
import { useBuiltSites } from "../api";
import { useBuilderStore } from "../../../stores/builder";

/** Picks which built site the builder pages operate on. */
export default function SitePicker({ hint }: { hint?: string }) {
  const siteId = useBuilderStore((s) => s.siteId);
  const setSiteId = useBuilderStore((s) => s.setSiteId);
  const { data: sites, isLoading } = useBuiltSites();

  if (isLoading) return <p className="text-sm text-slate-500">Loading sites…</p>;
  if (!sites || sites.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm">No built sites yet.</p>
        <Link to="/websites/new" className="mt-2 inline-block rounded bg-slate-900 px-4 py-2 text-sm text-white">
          Add a website (choose “Built”)
        </Link>
      </div>
    );
  }

  return (
    <label className="flex max-w-md items-center gap-2 text-sm">
      <span className="font-medium">Site</span>
      <select
        value={siteId ?? ""}
        onChange={(e) => setSiteId(e.target.value ? Number(e.target.value) : null)}
        className="flex-1 rounded border p-2 dark:border-slate-600 dark:bg-slate-700"
      >
        <option value="">Select a built site…</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.domain})
          </option>
        ))}
      </select>
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
