import { useState } from "react";
import { Link } from "react-router-dom";
import { useApplyTemplate, useBuiltSites, useTemplates } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import { Card, CardTitle } from "../../../shared/ui/kit";
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
      <h1 className="text-2xl font-bold">Templates</h1>
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
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(templates ?? []).map((t) => (
                <Card key={t.slug}>
                  <CardTitle>{t.pages} pages · menu included</CardTitle>
                  <h2 className="mt-1 text-lg font-bold">{t.name}</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.description}</p>
                  <button
                    onClick={() => {
                      if (window.confirm(`Apply the ${t.name} template to ${site?.name ?? "this site"}?`)) start(t.slug, false);
                    }}
                    disabled={apply.isPending}
                    className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                  >
                    {apply.isPending ? "Applying…" : `Use ${t.name}`}
                  </button>
                </Card>
              ))}
              {(templates ?? []).length === 0 && (
                <p className="text-sm text-slate-500">No templates available.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
