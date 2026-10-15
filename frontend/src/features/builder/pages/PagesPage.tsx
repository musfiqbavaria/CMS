import { useState } from "react";
import { Link } from "react-router-dom";
import { useApplyTemplate, useBuiltSites, useCreatePage, useDeletePage, usePages, useSetHomepage, useTemplates, useUpdatePage } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import { Card, PageHeader } from "../../../shared/ui/kit";
import SitePicker from "../components/SitePicker";
import SitePublishBar from "../components/SitePublishBar";

export default function PagesPage() {
  const siteId = useBuilderStore((s) => s.siteId);
  const { data: pages, isLoading } = usePages(siteId);
  const create = useCreatePage(siteId as number);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <PageHeader title="Pages" description="Create pages, shape their content, and decide what goes live." eyebrow="Content" />
      <SitePicker />
      {!siteId ? (
        <p className="text-sm text-slate-500">Select a site to manage its pages.</p>
      ) : (
        <>
          <SitePublishBar siteId={siteId} />
          <Card>
            <div className="flex gap-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New page title" className="flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700" />
              <button
                onClick={() => {
                  if (!title.trim()) return;
                  create.mutate(
                    { title: title.trim() },
                    { onSuccess: () => setTitle(""), onError: () => setMsg("Create failed.") },
                  );
                }}
                className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
              >
                Add page
              </button>
            </div>
            {msg && <p role="alert" className="mt-2 text-sm text-red-600">{msg}</p>}
          </Card>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (pages ?? []).length === 0 ? (
            <TemplateGallery siteId={siteId} />
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {(pages ?? []).map((p) => (
                  <PageRow key={p.id} siteId={siteId} pageId={p.id} title={p.title} slug={p.slug} status={p.status} sections={p.sections_count} />
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function TemplateGallery({ siteId }: { siteId: number }) {
  const { data: templates } = useTemplates(siteId);
  const apply = useApplyTemplate(siteId);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <h2 className="font-bold">Start from a template</h2>
      <p className="mt-1 text-sm text-slate-500">
        No pages yet. Pick a starter — pages, sections, menu and homepage are created published.
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {(templates ?? []).map((t) => (
          <div key={t.slug} className="rounded-lg border p-3 dark:border-slate-700">
            <h3 className="font-bold">{t.name}</h3>
            <p className="mt-1 text-xs text-slate-500">{t.description}</p>
            <p className="mt-1 text-xs text-slate-500">{t.pages} pages</p>
            <button
              onClick={() => apply.mutate({ template: t.slug }, { onError: () => setError("Could not apply template.") })}
              disabled={apply.isPending}
              className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {apply.isPending ? "Applying…" : `Use ${t.name}`}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PageRow({ siteId, pageId, title, slug, status, sections }: { siteId: number; pageId: number; title: string; slug: string; status: string; sections: number }) {
  const update = useUpdatePage(siteId, pageId);
  const remove = useDeletePage(siteId);
  const setHome = useSetHomepage(siteId);
  const { data: sites } = useBuiltSites();
  const homepageId = (sites ?? []).find((s) => s.id === siteId)?.homepage ?? null;
  const isHome = homepageId === pageId;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(title);
  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      {editing ? (
        <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border p-1 text-sm dark:border-slate-600 dark:bg-slate-700" />
      ) : (
        <Link to={`/builder/pages/${pageId}?site=${siteId}`} className="font-medium underline">
          {title}
        </Link>
      )}
      <span className="font-mono text-xs text-slate-500">/{slug}/</span>
      <span className="rounded bg-slate-100 px-1.5 text-xs capitalize dark:bg-slate-700">{status}</span>
      {isHome && <span className="rounded bg-green-100 px-1.5 text-xs text-green-800">homepage</span>}
      <span className="text-xs text-slate-500">{sections} sections</span>
      <span className="ml-auto flex gap-1">
        {editing ? (
          <button onClick={() => update.mutate({ title: name }, { onSuccess: () => setEditing(false) })} className="rounded border px-2 py-0.5 text-xs">Save</button>
        ) : (
          <button onClick={() => setEditing(true)} className="rounded border px-2 py-0.5 text-xs">Rename</button>
        )}
        <button
          onClick={() => update.mutate({ status: status === "published" ? "draft" : "published" })}
          className="rounded border px-2 py-0.5 text-xs"
        >
          {status === "published" ? "Unpublish" : "Publish"}
        </button>
        {!isHome && status === "published" && (
          <button onClick={() => setHome.mutate(pageId)} disabled={setHome.isPending} className="rounded border px-2 py-0.5 text-xs disabled:opacity-50">
            Set as homepage
          </button>
        )}
        <button onClick={() => { if (window.confirm(`Delete "${title}"?`)) remove.mutate(pageId); }} className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600">
          Delete
        </button>
      </span>
    </li>
  );
}
