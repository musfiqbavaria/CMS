import { useQueryClient } from "@tanstack/react-query";
import { useBuiltSites, useSiteTheme } from "../api";
import { useSetSiteStatus } from "../../sites/api";
import { StatusBadge } from "../../sites/components/StatusBadge";

/** Site-level publish controls for builder pages (Phase 12). */
export default function SitePublishBar({ siteId }: { siteId: number }) {
  const qc = useQueryClient();
  const { data: sites } = useBuiltSites();
  const { data: theme } = useSiteTheme(siteId);
  const setStatus = useSetSiteStatus();
  const site = (sites ?? []).find((s) => s.id === siteId);
  if (!site) return null;
  const live = site.status === "active";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-800">
      <StatusBadge status={site.status} />
      <span className="font-mono text-xs text-slate-500">{site.public_url || `https://${site.domain}`}</span>
      {theme?.theme_name && (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-700">{theme.theme_name}</span>
      )}
      <span className="ml-auto inline-flex gap-1">
        <a
          href={site.public_url || `https://${site.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border px-2 py-1 text-xs dark:border-slate-600"
        >
          View live
        </a>
        <button
          onClick={() =>
            setStatus.mutate(
              { id: site.id, active: !live },
              { onSuccess: () => qc.invalidateQueries({ queryKey: ["sites-built"] }) },
            )
          }
          disabled={setStatus.isPending}
          className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          {live ? "Unpublish site" : "Publish site"}
        </button>
      </span>
    </div>
  );
}
