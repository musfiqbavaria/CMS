import { useState } from "react";
import { useBlocker } from "react-router-dom";
import { usePublish, useResetDraft, useRollback, useVersions } from "../api";

export function VersionsPanel({ siteId, onRestored }: { siteId: number; onRestored: () => void }) {
  const { data, isLoading } = useVersions(siteId);
  const publish = usePublish(siteId);
  const rollback = useRollback(siteId);
  const [msg, setMsg] = useState<string | null>(null);

  function act(promise: Promise<unknown>, text: string) {
    setMsg(null);
    promise.then(
      () => {
        setMsg(text);
        onRestored();
      },
      () => setMsg("Action failed. Try again."),
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Version history</h2>
      {msg && <p role="status" className="mt-2 text-sm text-slate-600 dark:text-slate-300">{msg}</p>}
      {isLoading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
      {data && data.results.length === 0 && <p className="mt-2 text-sm text-slate-500">No saved versions yet.</p>}
      <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {data?.results.map((v) => (
          <li key={v.id} className="flex items-center gap-2 rounded border p-2 text-sm dark:border-slate-700">
            <span className="font-medium">v{v.version_no}</span>
            <span className="rounded bg-slate-100 px-1.5 text-xs capitalize dark:bg-slate-700">{v.status}</span>
            <span className="truncate text-xs text-slate-500">{v.note || new Date(v.created_at).toLocaleString()}</span>
            <span className="ml-auto flex gap-1">
              {v.status !== "published" && (
                <button
                  onClick={() => act(publish.mutateAsync(v.id), `Published v${v.version_no}.`)}
                  className="rounded border px-1.5 py-0.5 text-xs dark:border-slate-600"
                >
                  Publish
                </button>
              )}
              <button
                onClick={() => {
                  if (window.confirm(`Roll back the live site to v${v.version_no}?`)) {
                    act(rollback.mutateAsync(v.id), `Rolled back to v${v.version_no}.`);
                  }
                }}
                className="rounded border px-1.5 py-0.5 text-xs dark:border-slate-600"
              >
                Rollback
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResetDraftButton({ siteId, onDone }: { siteId: number; onDone: () => void }) {
  const reset = useResetDraft(siteId);
  return (
    <button
      onClick={() => {
        if (window.confirm("Discard unsaved draft changes and restore the published version?")) {
          reset.mutate(undefined, { onSuccess: onDone });
        }
      }}
      className="rounded border px-3 py-1.5 text-sm dark:border-slate-600"
    >
      Reset draft to published
    </button>
  );
}

export function UnsavedGuard({ when }: { when: boolean }) {
  const blocker = useBlocker(when);
  if (blocker.state !== "blocked") return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800">
        <h2 className="font-bold">Unsaved changes</h2>
        <p className="mt-1 text-sm text-slate-500">Leave without saving this draft?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => blocker.reset()} className="rounded border px-3 py-1.5 text-sm dark:border-slate-600">
            Stay
          </button>
          <button onClick={() => blocker.proceed()} className="rounded bg-red-600 px-3 py-1.5 text-sm text-white">
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
