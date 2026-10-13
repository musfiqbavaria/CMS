import { useState } from "react";
import { useCreateMenu, useMenuItemMutations, useMenuItems, useMenus } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import SitePicker from "../components/SitePicker";
import { moveItem } from "../components/SectionCard";

export default function MenusPage() {
  const siteId = useBuilderStore((s) => s.siteId);
  const { data: menus } = useMenus(siteId);
  const create = useCreateMenu(siteId as number);
  const [name, setName] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const active = (menus ?? []).find((m) => m.id === activeId) ?? (menus ?? [])[0];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Menus</h1>
      <SitePicker />
      {!siteId ? (
        <p className="text-sm text-slate-500">Select a site first.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New menu name" className="flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700" />
            <button
              onClick={() => { if (name.trim()) create.mutate({ name: name.trim() }, { onSuccess: () => setName("") }); }}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white"
            >
              Add menu
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(menus ?? []).map((m) => (
              <button key={m.id} onClick={() => setActiveId(m.id)} className={`rounded border px-3 py-1.5 text-sm ${active?.id === m.id ? "bg-slate-900 text-white" : ""}`}>
                {m.name} ({m.items.length})
              </button>
            ))}
          </div>
          {active && siteId && <MenuEditor key={active.id} siteId={siteId} menuId={active.id} />}
        </>
      )}
    </div>
  );
}

function MenuEditor({ siteId, menuId }: { siteId: number; menuId: number }) {
  const { data: items } = useMenuItems(siteId, menuId);
  const muts = useMenuItemMutations(siteId, menuId);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("/");

  function move(from: number, dir: -1 | 1) {
    const list = items ?? [];
    const to = from + dir;
    if (to < 0 || to >= list.length) return;
    muts.reorder.mutate(moveItem(list, from, to).map((i) => i.id));
  }

  return (
    <div className="rounded border p-3 text-sm dark:border-slate-700">
      <div className="flex gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" className="flex-1 rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/url" className="flex-1 rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" />
        <button
          onClick={() => { if (label.trim()) muts.add.mutate({ label: label.trim(), url: url || "/" }, { onSuccess: () => { setLabel(""); setUrl("/"); } }); }}
          className="rounded bg-slate-900 px-2 text-white"
        >
          Add
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {(items ?? []).map((it, i) => (
          <li key={it.id} className="flex items-center gap-2 rounded border p-1.5 dark:border-slate-700">
            <input defaultValue={it.label} key={`l-${it.id}`} onBlur={(e) => { if (e.target.value !== it.label) muts.patch.mutate({ id: it.id, label: e.target.value }); }} className="w-1/3 rounded border p-1 text-xs dark:border-slate-600 dark:bg-slate-700" />
            <input defaultValue={it.url} key={`u-${it.id}`} onBlur={(e) => { if (e.target.value !== it.url) muts.patch.mutate({ id: it.id, url: e.target.value }); }} className="flex-1 rounded border p-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-700" />
            <button onClick={() => move(i, -1)} aria-label="Move up" className="rounded border px-1 text-xs">↑</button>
            <button onClick={() => move(i, 1)} aria-label="Move down" className="rounded border px-1 text-xs">↓</button>
            <button onClick={() => muts.remove.mutate(it.id)} aria-label="Delete item" className="rounded border border-red-300 px-1 text-xs text-red-600">✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
