import { Link } from "react-router-dom";
import { PageHeader } from "../../../shared/ui/kit";
import { useAllSections } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import SitePicker from "../components/SitePicker";

export default function SectionsPage() {
  const siteId = useBuilderStore((s) => s.siteId);
  const { data: sections, isLoading } = useAllSections(siteId);

  return (
    <div className="space-y-4">
      <PageHeader title="Sections" description="Manage the building blocks that make every page yours." eyebrow="Content" />
      <SitePicker hint="Sections are edited inside their page" />
      {!siteId ? (
        <p className="text-sm text-slate-500">Select a site first.</p>
      ) : isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                <th className="p-2 font-medium">Page</th>
                <th className="p-2 font-medium">Type</th>
                <th className="p-2 font-medium">Position</th>
                <th className="p-2 font-medium">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {(sections ?? []).map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                  <td className="p-2">
                    <Link to={`/builder/pages/${s.page}?site=${siteId}`} className="underline">{s.page_title}</Link>
                  </td>
                  <td className="p-2">{s.type}</td>
                  <td className="p-2">{s.position}</td>
                  <td className="p-2">{s.enabled ? "Yes" : "No"}</td>
                </tr>
              ))}
              {(sections ?? []).length === 0 && (
                <tr><td colSpan={4} className="p-4 text-center text-slate-500">No sections yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
