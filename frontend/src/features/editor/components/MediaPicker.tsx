import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useDeleteMedia, useMedia, useUploadMedia } from "../api";

async function croppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");
  const scaleX = img.naturalWidth / img.width;
  const scaleY = img.naturalHeight / img.height;
  ctx.drawImage(
    img,
    area.x * scaleX,
    area.y * scaleY,
    area.width * scaleX,
    area.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), "image/png"),
  );
}

const ASPECTS = [
  { label: "Free", value: 0 },
  { label: "16:9", value: 16 / 9 },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
];

export default function MediaPicker({ siteId, onSelect, onClose }: { siteId: number; onSelect: (url: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const { data, isLoading } = useMedia(siteId);
  const upload = useUploadMedia();
  const remove = useDeleteMedia();
  const [raw, setRaw] = useState<string | null>(null);
  const [rawName, setRawName] = useState("upload.png");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [aspect, setAspect] = useState(0);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  function pickFile(file: File) {
    setError(null);
    setRawName(file.name.replace(/\.[^.]+$/, "") + ".png");
    const reader = new FileReader();
    reader.onload = () => setRaw(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function doUpload() {
    if (!raw) return;
    setError(null);
    try {
      const blob = area ? await croppedBlob(raw, area) : await (await fetch(raw)).blob();
      const asset = await upload.mutateAsync({ file: blob, filename: rawName, siteId, alt });
      setRaw(null);
      setTab("library");
      onSelect(asset.url);
    } catch {
      setError("Upload failed. Use a JPG/PNG/WebP/GIF under 10 MB.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800">
        <h2 className="text-lg font-bold">Choose image</h2>
        <div className="mt-2 flex gap-2 text-sm">
          <button onClick={() => setTab("library")} className={`rounded px-3 py-1 ${tab === "library" ? "bg-slate-900 text-white" : "border"}`}>Library</button>
          <button onClick={() => setTab("upload")} className={`rounded px-3 py-1 ${tab === "upload" ? "bg-slate-900 text-white" : "border"}`}>Upload</button>
        </div>

        {tab === "library" && (
          <div className="mt-3">
            {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
            {data && data.results.length === 0 && <p className="text-sm text-slate-500">No images yet — upload one.</p>}
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {data?.results.map((m) => (
                <li key={m.id} className="group relative rounded border dark:border-slate-700">
                  <button onClick={() => onSelect(m.url)} className="block w-full">
                    <img src={m.url} alt={m.alt || `media ${m.id}`} className="h-24 w-full object-cover" />
                  </button>
                  <button
                    onClick={() => remove.mutate(m.id)}
                    aria-label="Delete image"
                    className="absolute right-1 top-1 hidden rounded bg-red-600 px-1.5 text-xs text-white group-hover:block"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "upload" && (
          <div className="mt-3 space-y-3">
            {!raw ? (
              <label className="block cursor-pointer rounded border border-dashed p-6 text-center text-sm">
                Click to choose an image (JPG/PNG/WebP/GIF, ≤10 MB)
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
              </label>
            ) : (
              <>
                <div className="relative h-64 bg-black">
                  <Cropper image={raw} crop={crop} zoom={zoom} aspect={aspect || undefined} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Aspect:</span>
                  {ASPECTS.map((a) => (
                    <button key={a.label} onClick={() => setAspect(a.value)} className={`rounded border px-2 py-0.5 ${aspect === a.value ? "bg-slate-900 text-white" : ""}`}>
                      {a.label}
                    </button>
                  ))}
                  <label className="ml-auto flex items-center gap-1">
                    Zoom
                    <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
                  </label>
                </div>
                <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Alt text (optional)" className="w-full rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700" />
                <div className="flex gap-2">
                  <button onClick={() => setRaw(null)} className="rounded border px-3 py-1.5 text-sm">Choose another</button>
                  <button onClick={doUpload} disabled={upload.isPending} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">
                    {upload.isPending ? "Uploading…" : "Crop & upload"}
                  </button>
                </div>
              </>
            )}
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded border px-4 py-2 text-sm dark:border-slate-600">Close</button>
        </div>
      </div>
    </div>
  );
}
