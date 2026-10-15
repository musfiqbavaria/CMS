import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { api } from "../../../shared/api/client";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from "../../../shared/ui/kit";
import type { MediaAsset } from "../../editor/types";
import type { Paged } from "../../sites/types";

const PAGE_SIZE = 24;

export default function MediaPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["media-all", page], queryFn: () => api.get<Paged<MediaAsset>>(`/v1/media/?page_size=${PAGE_SIZE}&page=${page}`).then((response) => response.data) });
  const inputRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("alt", alt);
      await api.post("/v1/media/", form);
      setAlt("");
      setPage(1);
      await qc.invalidateQueries({ queryKey: ["media-all"] });
      await qc.invalidateQueries({ queryKey: ["media"] });
    } catch (exception: unknown) {
      const response = (exception as { response?: { data?: { detail?: unknown } } }).response;
      const detail = response?.data?.detail;
      setError(Array.isArray(detail) ? String(detail[0]) : typeof detail === "string" ? detail : "Upload failed. Choose a JPG, PNG, WebP, or GIF under 10 MB.");
    } finally { setBusy(false); }
  }

  async function onDelete(id: number) {
    if (!window.confirm("Delete this image? Existing pages that use it may show a missing image.")) return;
    setDeleting(id);
    setError(null);
    try {
      await api.delete(`/v1/media/${id}/`);
      if (data?.results.length === 1 && page > 1) setPage((value) => value - 1);
      await qc.invalidateQueries({ queryKey: ["media-all"] });
      await qc.invalidateQueries({ queryKey: ["media"] });
    } catch { setError("The image couldn't be deleted. Please try again."); }
    finally { setDeleting(null); }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Your creative library" eyebrow="Media library" description="Give your content a little more character. All your images, ready when inspiration strikes." actions={<Badge tone="blue">{data?.count ?? 0} assets</Badge>} />
      <Card>
        <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files[0]) void onFile(event.dataTransfer.files[0]); }} className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center transition ${dragging ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30" : "border-[var(--line)] bg-[var(--surface-soft)]"}`}>
          <span className="ui-icon-well mb-3">{busy ? <Loader2 size={21} className="animate-spin" aria-hidden="true" /> : <UploadCloud size={22} strokeWidth={1.6} aria-hidden="true" />}</span>
          <h2 className="text-sm font-semibold">{busy ? "Adding to your library..." : "Drop a little inspiration here"}</h2>
          <p className="mt-2 text-xs text-[var(--muted)]">Drag an image here, or choose one from your computer.</p>
          <Button className="mt-4" disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus size={14} aria-hidden="true" /> Choose an image</Button>
          <input ref={inputRef} aria-label="Upload an image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" disabled={busy} onChange={(event) => { if (event.target.files?.[0]) void onFile(event.target.files[0]); event.target.value = ""; }} />
          <p className="mt-3 text-[10px] text-[var(--muted)]">JPG, PNG, WebP, or GIF · Up to 10 MB</p>
        </div>
        <label className="mt-5 block text-xs font-medium" htmlFor="image-alt">Describe the image <span className="font-normal text-[var(--muted)]">(optional, for your next upload)</span><input id="image-alt" value={alt} onChange={(event) => setAlt(event.target.value)} placeholder="A short description helps people using screen readers." className="mt-2 w-full text-xs" /></label>
      </Card>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {isLoading ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-52" />)}</div> : isError ? <EmptyState title="Your library couldn't load" action={<Button onClick={() => void refetch()}>Try again</Button>} /> : data?.results.length ? (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{data.results.map((asset) => <li key={asset.id} className="group min-w-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm"><div className="relative aspect-[4/3] overflow-hidden bg-[var(--surface-soft)]"><img src={asset.url} alt={asset.alt || ""} loading="lazy" className="h-full w-full object-contain p-2" /><button onClick={() => void onDelete(asset.id)} disabled={deleting !== null} aria-label={`Delete ${asset.alt || `image ${asset.id}`}`} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-rose-600 shadow-sm transition hover:bg-rose-50 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">{deleting === asset.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}</button></div><div className="border-t border-[var(--line)] p-3"><p className="truncate text-xs font-medium">{asset.alt || asset.file.split("/").pop() || `Image ${asset.id}`}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{asset.width} × {asset.height} <span className="mx-1">·</span> {Math.round(asset.size / 1024)} KB</p></div></li>)}</ul>
      ) : <EmptyState icon={ImagePlus} title="Room for your first image" hint="Upload a photo, logo, or illustration. It will be available in your site editors." />}
      {data && data.count > PAGE_SIZE && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]"><p>Page {page} of {Math.ceil(data.count / PAGE_SIZE)} · {data.count} images</p><div className="flex gap-2"><Button disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={14} /> Previous</Button><Button disabled={!data.next} onClick={() => setPage((value) => value + 1)}>Next <ChevronRight size={14} /></Button></div></div>}
    </div>
  );
}
