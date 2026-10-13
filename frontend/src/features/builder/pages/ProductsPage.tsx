import { useState } from "react";
import {
  useCreateCategory,
  useCreateProduct,
  useDeleteProduct,
  useProductCategories,
  useProducts,
  useUpdateProduct,
} from "../api";
import { useBuilderStore } from "../../../stores/builder";
import type { Product } from "../types";
import SitePicker from "../components/SitePicker";

export default function ProductsPage() {
  const siteId = useBuilderStore((s) => s.siteId);
  const { data: products } = useProducts(siteId);
  const { data: cats } = useProductCategories(siteId);
  const create = useCreateProduct(siteId as number);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("9.99");
  const [catName, setCatName] = useState("");
  const addCat = useCreateCategory(siteId as number, "product-categories");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Products</h1>
      <SitePicker />
      {!siteId ? (
        <p className="text-sm text-slate-500">Select a site first.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" className="flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700" />
            <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="9.99" inputMode="decimal" className="w-24 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700" />
            <button
              onClick={() => {
                if (!name.trim()) return;
                create.mutate(
                  { name: name.trim(), price },
                  { onSuccess: () => { setName(""); }, onError: () => setMsg("Create failed (check the price).") },
                );
              }}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
            >
              Add product
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Categories: {(cats ?? []).map((c) => c.name).join(", ") || "—"}</span>
            <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="New category" className="rounded border p-1.5 text-xs dark:border-slate-600 dark:bg-slate-700" />
            <button onClick={() => { if (catName.trim()) addCat.mutate({ name: catName.trim() }, { onSuccess: () => setCatName("") }); }} className="rounded border px-2 py-1 text-xs">
              Add
            </button>
          </div>
          {msg && <p role="alert" className="text-sm text-red-600">{msg}</p>}
          <ul className="space-y-2">
            {(products ?? []).map((p) => (
              <ProductRow key={p.id} siteId={siteId} product={p} categories={(cats ?? []).map((c) => ({ id: c.id, name: c.name }))} />
            ))}
            {(products ?? []).length === 0 && <li className="text-sm text-slate-500">No products yet.</li>}
          </ul>
        </>
      )}
    </div>
  );
}

function ProductRow({ siteId, product: p, categories }: { siteId: number; product: Product; categories: { id: number; name: string }[] }) {
  const update = useUpdateProduct(siteId);
  const remove = useDeleteProduct(siteId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    price: p.price, compare_at: p.compare_at ?? "", stock: p.stock,
    description: p.description, category: p.category,
    images: p.images.join("\n"),
    variants: JSON.stringify(p.variants, null, 1),
  });
  const [err, setErr] = useState<string | null>(null);

  function save() {
    let variants: unknown = [];
    try {
      variants = JSON.parse(form.variants || "[]");
    } catch {
      setErr("Variants must be valid JSON.");
      return;
    }
    if (!Array.isArray(variants)) {
      setErr("Variants must be a list.");
      return;
    }
    setErr(null);
    update.mutate({
      id: p.id, price: form.price, compare_at: form.compare_at || null, stock: Number(form.stock) || 0,
      description: form.description, category: form.category,
      images: form.images.split("\n").map((s) => s.trim()).filter(Boolean), variants,
    });
  }

  return (
    <li className="rounded border p-3 text-sm dark:border-slate-700">
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen((v) => !v)} className="font-medium underline">{p.name}</button>
        <span className="font-mono text-xs text-slate-500">/shop/{p.slug}/</span>
        <span>${p.price} · stock {p.stock}</span>
        <span className="rounded bg-slate-100 px-1.5 text-xs capitalize dark:bg-slate-700">{p.status}</span>
        <span className="ml-auto flex gap-1">
          <button onClick={() => update.mutate({ id: p.id, status: p.status === "published" ? "draft" : "published" })} className="rounded border px-2 py-0.5 text-xs">
            {p.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <button onClick={() => { if (window.confirm("Delete product?")) remove.mutate(p.id); }} className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600">Delete</button>
        </span>
      </div>
      {open && (
        <div className="mt-2 grid gap-2 text-xs">
          <div className="flex gap-2">
            <label>Price<input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1 w-full rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" /></label>
            <label>Compare at<input value={form.compare_at} onChange={(e) => setForm({ ...form, compare_at: e.target.value })} className="mt-1 w-full rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" /></label>
            <label>Stock<input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className="mt-1 w-full rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" /></label>
            <label>Category
              <select value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value ? Number(e.target.value) : null })} className="mt-1 w-full rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700">
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1 w-full rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" /></label>
          <label>Images (one URL per line)<textarea value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} rows={2} className="mt-1 w-full rounded border p-1.5 font-mono dark:border-slate-600 dark:bg-slate-700" /></label>
          <label>Variants (JSON list)<textarea value={form.variants} onChange={(e) => setForm({ ...form, variants: e.target.value })} rows={3} className="mt-1 w-full rounded border p-1.5 font-mono dark:border-slate-600 dark:bg-slate-700" /></label>
          {err && <p role="alert" className="text-red-600">{err}</p>}
          <div><button onClick={save} className="rounded bg-slate-900 px-2 py-1 text-white">Save</button></div>
        </div>
      )}
    </li>
  );
}
