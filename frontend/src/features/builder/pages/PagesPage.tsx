import { useState } from "react";
import { Link } from "react-router-dom";
import { useCreatePage, useDeletePage, usePages, useUpdatePage } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import { Card } from "../../../shared/ui/kit";
import SitePicker from "../components/SitePicker";

export default function PagesPage() {
  const siteId = useBuilderStore((s) => s.siteId);
  const { data: pages, isLoading } = usePages(siteId);
  const create = useCreatePage(siteId as number);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pages</h1>
      <SitePicker />
      {!siteId ? (
        <p className="text-sm text-slate-500">Select a site to manage its pages.</p>
      ) : (
        <>
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
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {(pages ?? []).map((p) => (
                  <PageRow key={p.id} siteId={siteId} pageId={p.id} title={p.title} slug={p.slug} status={p.status} sections={p.sections_count} />
                ))}
                {(pages ?? []).length === 0 && <li className="py-4 text-center text-sm text-slate-500">No pages yet.</li>}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function PageRow({ siteId, pageId, title, slug, status, sections }: { siteId: number; pageId: number; title: string; slug: string; status: string; sections: number }) {
  const update = useUpdatePage(siteId, pageId);
  const remove = useDeletePage(siteId);
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
        <button onClick={() => { if (window.confirm(`Delete "${title}"?`)) remove.mutate(pageId); }} className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600">
          Delete
        </button>
      </span>
    </li>
  );
}
