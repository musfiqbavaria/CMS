import type { Site } from "../types";

interface Props {
  open: boolean;
  site: Site | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({ open, site, busy, onClose, onConfirm }: Props) {
  if (!open || !site) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 className="text-lg font-bold">Delete website</h2>
        <p className="mt-2 text-sm">
          Delete <strong>{site.name}</strong> ({site.domain})? This cannot be undone. The
          deletion is recorded in the audit log.
        </p>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onClose} className="rounded border px-4 py-2 text-sm dark:border-slate-600">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
