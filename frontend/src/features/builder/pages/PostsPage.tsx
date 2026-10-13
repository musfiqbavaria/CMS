import { useState } from "react";
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
      <h1 className="text-2xl font-bold">Posts</h1>
      <SitePicker />
      {!siteId ? (
        <p className="text-sm text-slate-500">Select a site first.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New post title" className="flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700" />
            <button
              onClick={() => {
                if (!title.trim()) return;
                create.mutate({ title: title.trim() }, { onSuccess: () => setTitle(""), onError: () => setMsg("Create failed.") });
              }}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
            >
              Add post
            </button>
          </div>
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
          <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="New category" className="flex-1 rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700" />
          <button onClick={() => { if (catName.trim()) addCat.mutate({ name: catName.trim() }, { onSuccess: () => setCatName("") }); }} className="rounded border px-2 text-xs">Add</button>
        </div>
      </div>
      <div className="rounded border p-3 dark:border-slate-700">
        <p className="font-semibold">Tags: {(tags.data ?? []).map((t) => t.name).join(", ") || "—"}</p>
        <div className="mt-2 flex gap-1">
          <input value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="New tag" className="flex-1 rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700" />
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
    <li className="rounded border p-3 dark:border-slate-700">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((v) => !v)} className="font-medium underline">{props.title}</button>
        <span className="font-mono text-xs text-slate-500">/blog/{props.slug}/</span>
        <span className="rounded bg-slate-100 px-1.5 text-xs capitalize dark:bg-slate-700">{props.status}</span>
        <span className="ml-auto flex gap-1">
          <button onClick={() => update.mutate({ id: postId, status: props.status === "published" ? "draft" : "published" })} className="rounded border px-2 py-0.5 text-xs">
            {props.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <button onClick={() => { if (window.confirm("Delete post?")) remove.mutate(postId); }} className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600">Delete</button>
        </span>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 text-xs">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" />
          <textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Excerpt" rows={2} className="rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" />
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Body (HTML)" rows={5} className="rounded border p-1.5 font-mono dark:border-slate-600 dark:bg-slate-700" />
          <div className="flex gap-2">
            <select value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value ? Number(e.target.value) : null })} className="rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700">
              <option value="">No category</option>
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags (comma separated slugs)" className="flex-1 rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" />
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
