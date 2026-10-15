import { Link } from "react-router-dom";
import { Globe2, Plus } from "lucide-react";
import { useBuiltSites } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import { EmptyState, Skeleton } from "../../../shared/ui/kit";

export default function SitePicker({ hint }: { hint?: string }) {
  const siteId = useBuilderStore((state) => state.siteId);
  const setSiteId = useBuilderStore((state) => state.setSiteId);
  const { data: sites, isLoading, isError, refetch } = useBuiltSites();
  if (isLoading) return <Skeleton className="h-20" />;
  if (isError) return <EmptyState title="Websites couldn't load" hint="Please check your connection." action={<button onClick={() => void refetch()} className="ui-button" data-variant="secondary">Try again</button>} />;
  if (!sites?.length) return <EmptyState icon={Globe2} title="A blank canvas, just for you" hint="Create your first hosted website, then choose a template to get started." action={<Link className="ui-button" data-variant="primary" to="/builder/new"><Plus size={14} /> Build a website</Link>} />;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <span className="ui-icon-well !h-9 !w-9 !rounded-lg"><Globe2 size={17} aria-hidden="true" /></span>
      <label className="min-w-0 flex-1 sm:max-w-sm"><span className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">Working on</span><select aria-label="Selected website" value={siteId ?? ""} onChange={(event) => setSiteId(event.target.value ? Number(event.target.value) : null)} className="w-full !min-h-8 !py-1 text-xs"><option value="">Choose a website...</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name} · {site.domain}</option>)}</select></label>
      {hint && <p className="w-full text-[11px] text-[var(--muted)] sm:ml-auto sm:w-auto">{hint}</p>}
    </div>
  );
}
