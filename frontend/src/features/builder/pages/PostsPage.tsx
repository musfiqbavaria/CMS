import { useState } from "react";
import { Badge, Card, PageHeader } from "../../../shared/ui/kit";
import { useCreateCategory, useCreatePost, useDeletePost, usePosts, usePostTaxonomy, useUpdatePost } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import SitePicker from "../components/SitePicker";

export default function PostsPage() {
  const siteId = useBuilderStore((s) => s.siteId);
  const { data: posts } = usePosts(siteId);
  const { cats } = usePostTaxonomy(siteId);
  const create = useCreatePost(siteId as number);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <PageHeader title="Posts" description="Write your next story and keep your audience up to date." eyebrow="Content" />
      <SitePicker />
      {!siteId ? (
        <p className="text-sm text-slate-500">Select a site first.</p>
      ) : (
        <>
          <Card><div className="flex flex-wrap gap-2">
            <input aria-label="New post title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New post title" className="flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700" />
            <button
              disabled={create.isPending || !title.trim()}
              onClick={() => {
                if (!title.trim()) return;
                create.mutate({ title: title.trim() }, { onSuccess: () => setTitle(""), onError: () => setMsg("Create failed.") });
              }}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
            >
              {create.isPending ? "Adding..." : "Add post"}
            </button>
          </div></Card>
          {msg && <p role="alert" className="text-sm text-red-600">{msg}</p>}
          <Taxonomy siteId={siteId} />
          <ul className="space-y-2">
            {(posts ?? []).map((p) => (
              <PostRow key={p.id} siteId={siteId} postId={p.id} title={p.title} slug={p.slug} status={p.status}
                excerpt={p.excerpt} body={p.body} category={p.category} tags={p.tags}
                categories={(cats.data ?? []).map((c) => ({ id: c.id, name: c.name }))} />
            ))}
            {(posts ?? []).length === 0 && <li className="text-sm text-slate-500">No posts yet.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function Taxonomy({ siteId }: { siteId: number }) {
  const { cats, tags } = usePostTaxonomy(siteId);
  const addCat = useCreateCategory(siteId, "post-categories");
  const addTag = useCreateCategory(siteId, "tags");
  const [catName, setCatName] = useState("");
  const [tagName, setTagName] = useState("");
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-2">
      <div className="rounded border p-3 dark:border-slate-700">
        <p className="font-semibold">Categories: {(cats.data ?? []).map((c) => c.name).join(", ") || "—"}</p>
        <div className="mt-2 flex gap-1">
          <input aria-label="New post category" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="New category" className="flex-1 rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700" />
          <button onClick={() => { if (catName.trim()) addCat.mutate({ name: catName.trim() }, { onSuccess: () => setCatName("") }); }} className="rounded border px-2 text-xs">Add</button>
        </div>
      </div>
      <div className="rounded border p-3 dark:border-slate-700">
        <p className="font-semibold">Tags: {(tags.data ?? []).map((t) => t.name).join(", ") || "—"}</p>
        <div className="mt-2 flex gap-1">
          <input aria-label="New tag" value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="New tag" className="flex-1 rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700" />
          <button onClick={() => { if (tagName.trim()) addTag.mutate({ name: tagName.trim() }, { onSuccess: () => setTagName("") }); }} className="rounded border px-2 text-xs">Add</button>
        </div>
      </div>
    </div>
  );
}

function PostRow(props: {
  siteId: number; postId: number; title: string; slug: string; status: string;
  excerpt: string; body: string; category: number | null; tags: string[];
  categories: { id: number; name: string }[];
}) {
  const { siteId, postId } = props;
  const update = useUpdatePost(siteId);
  const remove = useDeletePost(siteId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: props.title, excerpt: props.excerpt, body: props.body, category: props.category, tags: props.tags.join(", ") });
  return (
    <li className="ui-card">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><button aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-left text-sm font-semibold [overflow-wrap:anywhere] hover:text-blue-600">{props.title}</button><p className="mt-1 break-all font-mono text-[11px] text-[var(--muted)]">/blog/{props.slug}/</p></div>
        <Badge tone={props.status === "published" ? "green" : "slate"}>{props.status}</Badge>
        <span className="flex w-full flex-wrap gap-2 border-t border-[var(--line)] pt-3 sm:ml-auto sm:w-auto sm:border-0 sm:pt-0">
          <button onClick={() => update.mutate({ id: postId, status: props.status === "published" ? "draft" : "published" })} className="rounded border px-2 py-0.5 text-xs">
            {props.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <button onClick={() => { if (window.confirm("Delete post?")) remove.mutate(postId); }} className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600">Delete</button>
        </span>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 text-xs">
          <input aria-label="Post title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" />
          <textarea aria-label="Post excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Excerpt" rows={2} className="rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" />
          <textarea aria-label="Post body (HTML)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Body (HTML)" rows={5} className="rounded border p-1.5 font-mono dark:border-slate-600 dark:bg-slate-700" />
          <div className="flex flex-wrap gap-2">
            <select aria-label="Post category" value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value ? Number(e.target.value) : null })} className="rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700">
              <option value="">No category</option>
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input aria-label="Post tags (comma separated slugs)" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags (comma separated slugs)" className="flex-1 rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" />
            <button
              onClick={() => update.mutate({ id: postId, title: form.title, excerpt: form.excerpt, body: form.body, category: form.category, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) })}
              className="rounded bg-slate-900 px-2 text-white"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
