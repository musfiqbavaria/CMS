import { Link } from "react-router-dom";
import { CheckCircle2, Circle } from "lucide-react";
import { useBuiltSites, useMenus, usePages, useSiteTheme } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import { Card, CardTitle } from "../../../shared/ui/kit";
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
        <h1 className="text-2xl font-bold">Builder</h1>
        <p className="text-sm text-slate-500">
          Create a site, pick a template, style it, write content, then publish — each step lives below.
        </p>
        <SitePicker />
        {!siteId && <p className="text-sm text-slate-500">Select a built site to see its progress.</p>}
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
      <h1 className="text-2xl font-bold">Builder</h1>
      <SitePicker />
      <SitePublishBar siteId={siteId} />
      <Card>
        <CardTitle>
          {site.name} · {done} of {steps.length} steps complete
        </CardTitle>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${Math.round((done / steps.length) * 100)}%` }}
          />
        </div>
        <ul className="mt-3 space-y-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2.5 dark:border-slate-700">
              {s.done ? (
                <CheckCircle2 size={20} className="shrink-0 text-green-500" />
              ) : (
                <Circle size={20} className="shrink-0 text-slate-300 dark:text-slate-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.label}</p>
                <p className="truncate text-xs text-slate-500">{s.hint}</p>
              </div>
              {!s.done && (
                <Link to={s.to} className="shrink-0 rounded border px-2 py-1 text-xs dark:border-slate-600">
                  {s.cta}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
