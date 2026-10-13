import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  useAddSection,
  useDeleteSection,
  usePage,
  usePatchSection,
  useReorderSections,
  useSections,
  useUpdatePage,
} from "../api";
import { SECTION_TYPES } from "../sectionTypes";
import SectionCard, { moveItem } from "../components/SectionCard";
import { useBuilderStore } from "../../../stores/builder";
import { Card } from "../../../shared/ui/kit";
import type { Section } from "../types";

export default function PageEditorPage() {
  const { pageId } = useParams();
  const [params] = useSearchParams();
  const storeSiteId = useBuilderStore((s) => s.siteId);
  const setSiteId = useBuilderStore((s) => s.setSiteId);
  const querySite = params.get("site") ? Number(params.get("site")) : null;
  const siteId = querySite ?? storeSiteId;
  const pid = Number(pageId);

  useEffect(() => {
    if (querySite && querySite !== storeSiteId) setSiteId(querySite);
  }, [querySite, storeSiteId, setSiteId]);

  const { data: page } = usePage(siteId, Number.isFinite(pid) ? pid : null);
  const { data: sections } = useSections(siteId, Number.isFinite(pid) ? pid : null);
  const updatePage = useUpdatePage(siteId as number, pid);
  const addSection = useAddSection(siteId as number, pid);
  const patchSection = usePatchSection(siteId as number, pid);
  const deleteSection = useDeleteSection(siteId as number, pid);
  const reorder = useReorderSections(siteId as number, pid);
  const [newType, setNewType] = useState("hero");
  const [seoOpen, setSeoOpen] = useState(false);
  const [seo, setSeo] = useState<{ title: string; description: string } | null>(null);
  const dragFrom = useRef<number | null>(null);

  if (!siteId) return <p className="text-sm">Missing site. <Link to="/builder/pages" className="underline">Pick one</Link>.</p>;
  if (!page) return <p className="text-sm text-slate-500">Loading page…</p>;

  function move(from: number, dir: -1 | 1) {
    const list = sections ?? [];
    const to = from + dir;
    if (to < 0 || to >= list.length) return;
    reorder.mutate(moveItem(list, from, to).map((s) => s.id));
  }

  function dropAt(to: number) {
    const list = sections ?? [];
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === to) return;
    reorder.mutate(moveItem(list, from, to).map((s) => s.id));
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/builder/pages" className="text-sm text-slate-500 underline">← Pages</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{page.title}</h1>
          <span className="font-mono text-xs text-slate-500">/{page.slug}/</span>
          <span className="rounded bg-slate-100 px-1.5 text-xs capitalize dark:bg-slate-700">{page.status}</span>
          <button
            onClick={() => updatePage.mutate({ status: page.status === "published" ? "draft" : "published" })}
            className="rounded border px-2 py-1 text-xs"
          >
            {page.status === "published" ? "Unpublish" : "Publish"}
          </button>
          <button onClick={() => { setSeo({ title: page.seo?.title ?? "", description: page.seo?.description ?? "" }); setSeoOpen((v) => !v); }} className="rounded border px-2 py-1 text-xs">
            SEO
          </button>
        </div>
        {seoOpen && seo && (
          <Card>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs">Meta title<input value={seo.title} onChange={(e) => setSeo({ ...seo, title: e.target.value })} className="mt-1 w-full rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" /></label>
              <label className="text-xs">Meta description<input value={seo.description} onChange={(e) => setSeo({ ...seo, description: e.target.value })} className="mt-1 w-full rounded border p-1.5 dark:border-slate-600 dark:bg-slate-700" /></label>
            </div>
            <button onClick={() => updatePage.mutate({ seo } as Partial<typeof page>)} className="mt-2 rounded bg-slate-900 px-2 py-1 text-xs text-white">
              Save SEO
            </button>
          </Card>
        )}
      </div>

      <Card>
        <div className="flex gap-2">
          <select value={newType} onChange={(e) => setNewType(e.target.value)} className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700">
            {SECTION_TYPES.map((t) => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
          <button onClick={() => addSection.mutate({ type: newType })} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">
            Add section
          </button>
        </div>
      </Card>

      <ul className="space-y-3">
        {(sections ?? []).map((s: Section, i: number) => (
          <SectionCard
            key={s.id}
            section={s}
            saving={patchSection.isPending}
            onSave={(patch) => patchSection.mutate({ id: s.id, ...patch })}
            onDelete={() => deleteSection.mutate(s.id)}
            onMove={(dir) => move(i, dir)}
            onDragStart={() => {
              dragFrom.current = i;
            }}
            onDrop={() => dropAt(i)}
          />
        ))}
        {(sections ?? []).length === 0 && (
          <li className="rounded border border-dashed p-6 text-center text-sm text-slate-500">
            No sections yet — add your first block above. Drag cards to reorder.
          </li>
        )}
      </ul>
    </div>
  );
}
