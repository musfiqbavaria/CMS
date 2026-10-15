import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileText, LayoutTemplate, Palette, Plus } from "lucide-react";
import { useBuiltSites, useMenus, usePages, useSiteTheme } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import { Badge, Card, CardTitle, PageHeader } from "../../../shared/ui/kit";
import SitePicker from "../components/SitePicker";
import SitePublishBar from "../components/SitePublishBar";

interface Step {
  label: string;
  hint: string;
  done: boolean;
  to: string;
  cta: string;
}

/** Guided builder hub: what to do next, in order (Phase 14). */
export default function BuilderHome() {
  const siteId = useBuilderStore((s) => s.siteId);
  const { data: sites } = useBuiltSites();
  const { data: pages } = usePages(siteId);
  const { data: theme } = useSiteTheme(siteId);
  const { data: menus } = useMenus(siteId);
  const site = (sites ?? []).find((s) => s.id === siteId);

  if (!siteId || !site) {
    return (
      <div className="space-y-4">
        <PageHeader title="Website builder" description="Everything you need to take your next website from idea to launch." eyebrow="Build" />
        <SitePicker />
        <BuilderQuickLinks />
        {!siteId && <p className="text-xs text-[var(--muted)]">Choose a website above to see your launch checklist.</p>}
      </div>
    );
  }

  const published = (pages ?? []).filter((p) => p.status === "published");
  const customVerified = (site.domains ?? []).some(
    (d) => d.kind === "custom" && d.verification_status === "verified",
  );
  const steps: Step[] = [
    {
      label: "Start from a template",
      hint: `${pages?.length ?? 0} pages · Business, Portfolio, Store, Restaurant or Blog seeds pages, menu and homepage.`,
      done: (pages?.length ?? 0) > 0,
      to: "/templates",
      cta: "Browse templates",
    },
    {
      label: "Apply a visual theme",
      hint: theme?.theme_name ? `Active: ${theme.theme_name}.` : "Colors and fonts for the whole site.",
      done: theme?.theme != null,
      to: "/builder/themes",
      cta: "Choose theme",
    },
    {
      label: "Set the homepage",
      hint: "The published page served at the site root.",
      done: site.homepage != null,
      to: "/builder/pages",
      cta: "Pick homepage",
    },
    {
      label: "Add navigation",
      hint: `${menus?.length ?? 0} menus · shown in the site header.`,
      done: (menus?.length ?? 0) > 0,
      to: "/builder/menus",
      cta: "Edit menus",
    },
    {
      label: "Publish content",
      hint: `${published.length} of ${pages?.length ?? 0} pages live. Only published pages render.`,
      done: published.length > 0,
      to: "/builder/pages",
      cta: "Review pages",
    },
    {
      label: "Publish the site",
      hint: site.status === "active" ? "Live now." : "Inactive sites never render, whatever is published.",
      done: site.status === "active",
      to: "/builder/pages",
      cta: "Publish",
    },
    {
      label: "Attach a custom domain",
      hint: customVerified ? "Verified custom address live." : "Optional — the free subdomain works already.",
      done: customVerified,
      to: `/websites/${site.id}/domains`,
      cta: "Manage domains",
    },
  ];
  const done = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Website builder" description="Everything you need to take your next website from idea to launch." eyebrow="Build" actions={<Link to="/builder/new" className="ui-button" data-variant="primary"><Plus size={14} /> New website</Link>} />
      <SitePicker />
      <SitePublishBar siteId={siteId} />
      <BuilderQuickLinks />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Your launch checklist</CardTitle><p className="mt-1 text-xs text-[var(--muted)]">A few thoughtful steps to get {site.name} ready.</p></div><Badge tone="blue">{done} of {steps.length} complete</Badge></div>
        <div role="progressbar" aria-label="Launch checklist completion" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} className="mt-5 h-1.5 overflow-hidden rounded-full bg-[var(--line)]">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${Math.round((done / steps.length) * 100)}%` }}
          />
        </div>
        <ul className="mt-4 divide-y divide-[var(--line)]">
          {steps.map((s, index) => (
            <li key={s.label} className="flex flex-wrap items-center gap-3 py-4">
              {s.done ? (
                <CheckCircle2 size={20} className="shrink-0 text-green-500" />
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--line)] text-[10px] text-[var(--muted)]">{index + 1}</span>
              )}
              <div className="min-w-[140px] flex-1">
                <p className="text-xs font-semibold">{s.label}</p>
                <p className="mt-1 text-[11px] leading-5 text-[var(--muted)]">{s.hint}</p>
              </div>
              {!s.done && (
                <Link to={s.to} className="ui-button !min-h-8 !px-2.5 !text-[10px]" data-variant="secondary">
                  {s.cta}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card><div className="ui-eyebrow">The bigger picture</div><h2 className="text-lg font-semibold">{site.name}</h2><p className="mt-1 break-all text-xs text-[var(--muted)]">{site.domain}</p><div className="mt-6 space-y-4">{[{ label: "Pages", value: pages?.length ?? 0 }, { label: "Published pages", value: published.length }, { label: "Navigation menus", value: menus?.length ?? 0 }].map((item) => <div key={item.label} className="flex justify-between text-xs"><span className="text-[var(--muted)]">{item.label}</span><span className="font-semibold">{item.value}</span></div>)}</div><div className="ui-section-divider"><p className="text-xs font-semibold">Make it feel like you.</p><p className="mt-2 text-xs leading-6 text-[var(--muted)]">Templates give you a starting point. Your words, images, and finishing touches make it your own.</p><Link to="/builder/pages" className="mt-4 flex items-center gap-2 text-xs font-medium text-[var(--accent)]">Keep building <ArrowRight size={13} /></Link></div></Card>
      </div>
    </div>
  );
}

function BuilderQuickLinks() {
  return <div className="grid gap-4 md:grid-cols-3">{[{ to: "/templates", icon: LayoutTemplate, title: "Find your starting point", detail: "Browse the template collection" }, { to: "/builder/themes", icon: Palette, title: "Make it your own", detail: "Explore colors and typography" }, { to: "/builder/pages", icon: FileText, title: "Tell your story", detail: "Create and edit your pages" }].map((item) => <Link key={item.to} to={item.to} className="ui-action-card"><span className="ui-icon-well"><item.icon size={19} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{item.title}</span><span className="mt-1 block text-[10px] leading-5 text-[var(--muted)]">{item.detail}</span></span><ArrowRight size={13} className="shrink-0 text-slate-400" aria-hidden="true" /></Link>)}</div>;
}
