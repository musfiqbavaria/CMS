import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../shared/api/client";
import type { MediaAsset } from "../../editor/types";
import type { Paged } from "../../sites/types";

function useAllMedia() {
  return useQuery({
    queryKey: ["media-all"],
    queryFn: () => api.get<Paged<MediaAsset>>("/v1/media/?page_size=100").then((r) => r.data),
  });
}

export default function MediaPage() {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useAllMedia();
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      // Shared library upload (no site). Per-site uploads live in the editor picker.
      const form = new FormData();
      form.append("file", file);
      form.append("alt", alt);
      await api.post("/v1/media/", form, { headers: { "Content-Type": "multipart/form-data" } });
      setAlt("");
      refetch();
    } catch {
      setError("Upload failed. Use a JPG/PNG/WebP/GIF under 10 MB.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    await api.delete(`/v1/media/${id}/`);
    qc.invalidateQueries({ queryKey: ["media-all"] });
    qc.invalidateQueries({ queryKey: ["media"] });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Media Library</h1>
      <div className="flex flex-wrap items-center gap-2">
        <label className={`cursor-pointer rounded px-3 py-2 text-sm text-white ${busy ? "bg-slate-400" : "bg-slate-900"}`}>
          {busy ? "Uploading…" : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.[0]) void onFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>
        <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alt text" className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700" />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {(data?.results ?? []).map((m) => (
            <li key={m.id} className="group relative rounded border dark:border-slate-700">
              <img src={m.url} alt={m.alt || `media ${m.id}`} className="h-28 w-full object-cover" />
              <p className="truncate px-1 py-0.5 font-mono text-[10px] text-slate-500">{m.width}×{m.height} · {Math.round(m.size / 1024)} KB</p>
              <button onClick={() => void onDelete(m.id)} aria-label="Delete image" className="absolute right-1 top-1 hidden rounded bg-red-600 px-1.5 text-xs text-white group-hover:block">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {(data?.results ?? []).length === 0 && !isLoading && <p className="text-sm text-slate-500">Library is empty.</p>}
    </div>
  );
}
