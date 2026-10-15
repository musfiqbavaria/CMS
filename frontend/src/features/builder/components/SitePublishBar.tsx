import { useQueryClient } from "@tanstack/react-query";
import { useBuiltSites, useSiteTheme } from "../api";
import { publicSiteUrl } from "../../sites/links";
import { useSetSiteStatus } from "../../sites/api";
import { StatusBadge } from "../../sites/components/StatusBadge";
import { ArrowUpRight, Globe2, Rocket } from "lucide-react";

/** Site-level publish controls for builder pages (Phase 12). */
export default function SitePublishBar({ siteId }: { siteId: number }) {
  const qc = useQueryClient();
  const { data: sites } = useBuiltSites();
  const { data: theme } = useSiteTheme(siteId);
  const setStatus = useSetSiteStatus();
  const site = (sites ?? []).find((s) => s.id === siteId);
  if (!site) return null;
  const live = site.status === "active";
  const liveUrl = publicSiteUrl(site.public_url || site.domain);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-xs">
      <Globe2 size={16} className="text-[var(--muted)]" aria-hidden="true" />
      <StatusBadge status={site.status} />
      <span className="min-w-0 break-all text-xs text-[var(--muted)]">{liveUrl}</span>
      {theme?.theme_name && (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-700">{theme.theme_name}</span>
      )}
      <span className="ml-auto inline-flex flex-wrap gap-2">
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ui-button !min-h-8 !px-2.5 !text-[10px]" data-variant="secondary"
        >
          View live <ArrowUpRight size={12} aria-hidden="true" />
        </a>
        <button
          onClick={() =>
            setStatus.mutate(
              { id: site.id, active: !live },
              { onSuccess: () => qc.invalidateQueries({ queryKey: ["sites-built"] }) },
            )
          }
          disabled={setStatus.isPending}
          className="ui-button !min-h-8 !px-2.5 !text-[10px]" data-variant="primary"
        >
          <Rocket size={12} aria-hidden="true" />{setStatus.isPending ? "Updating..." : live ? "Unpublish site" : "Publish site"}
        </button>
      </span>
    </div>
  );
}
