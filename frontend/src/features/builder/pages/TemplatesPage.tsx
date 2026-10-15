import { useState } from "react";
import { Link } from "react-router-dom";
import { useApplyTemplate, useBuiltSites, useTemplates } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from "../../../shared/ui/kit";
import { ArrowRight, Check, LayoutTemplate } from "lucide-react";
import TemplatePreview from "../components/TemplatePreview";
import SitePicker from "../components/SitePicker";
import SitePublishBar from "../components/SitePublishBar";

/** Starter site templates (pages + sections + menu), distinct from visual themes. */
export default function TemplatesPage() {
  const siteId = useBuilderStore((s) => s.siteId);
  const { data: sites } = useBuiltSites();
  const { data: templates, isLoading } = useTemplates(siteId);
  const apply = useApplyTemplate(siteId as number);
  const [error, setError] = useState<string | null>(null);
  const [forceSlug, setForceSlug] = useState<string | null>(null);
  const site = (sites ?? []).find((s) => s.id === siteId);

  function start(template: string, force: boolean) {
    setError(null);
    setForceSlug(null);
    apply.mutate(
      { template, force },
      {
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail ??
            (e as { response?: { data?: unknown } }).response?.data;
          const text = Array.isArray(msg) ? String(msg[0]) : typeof msg === "string" ? msg : "Could not apply template.";
          if (!force && /already has pages/i.test(text)) {
            setForceSlug(template);
          } else {
            setError(text);
          }
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="A head start on something great" eyebrow="Template collection" description="Choose a starting point, add your own story, and make it unmistakably yours." />
      <p className="text-sm text-slate-500">
        Starter packs that seed pages, sections, a nav menu and the homepage. Visual
        styles live under <Link to="/builder/themes" className="underline">Themes</Link>.
      </p>
      <SitePicker hint="Templates apply to the selected site" />
      {!siteId ? (
        <p className="text-sm text-slate-500">Select a site to browse templates.</p>
      ) : (
        <>
          <SitePublishBar siteId={siteId} />
          {error && (
            <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">
              {error} <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
            </p>
          )}
          {forceSlug && (
            <Card>
              <p className="text-sm">
                <strong>{site?.name}</strong> already has pages. Applying replaces its
                pages and menus — posts, products and media are kept.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => start(forceSlug, true)}
                  disabled={apply.isPending}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {apply.isPending ? "Replacing…" : "Replace with template"}
                </button>
                <button onClick={() => setForceSlug(null)} className="rounded border px-3 py-1.5 text-sm dark:border-slate-600">
                  Keep my pages
                </button>
              </div>
            </Card>
          )}
          {isLoading ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <Skeleton key={item} className="h-80" />)}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(templates ?? []).map((t) => (
                <Card key={t.slug} className="flex flex-col gap-4">
                  <TemplatePreview slug={t.slug} name={t.name} />
                  <div><div className="flex items-center justify-between gap-2"><h2 className="text-base font-semibold">{t.name}</h2><Badge tone="slate">{t.pages} pages</Badge></div><p className="mt-2 text-xs leading-6 text-[var(--muted)]">{t.description}</p></div>
                  <p className="mt-auto flex items-center gap-1.5 text-[10px] text-[var(--muted)]"><Check size={12} className="text-emerald-500" aria-hidden="true" /> Pages, navigation, and homepage included</p>
                  <Button variant="primary"
                    onClick={() => {
                      if (window.confirm(`Apply the ${t.name} template to ${site?.name ?? "this site"}?`)) start(t.slug, false);
                    }}
                    disabled={apply.isPending}
                    className="w-full"
                  >
                    {apply.isPending ? "Applying…" : `Use ${t.name}`} <ArrowRight size={14} aria-hidden="true" />
                  </Button>
                </Card>
              ))}
              {(templates ?? []).length === 0 && (
                <div className="sm:col-span-2 xl:col-span-3"><EmptyState icon={LayoutTemplate} title="No templates available" hint="Templates will appear here when they're available for this site." /></div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
