import { useState } from "react";
import { useBlocker } from "react-router-dom";
import { History, RotateCcw } from "lucide-react";
import { Badge, Button, Card, Spinner } from "../../../shared/ui/kit";
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
    <Card>
      <h2 className="ui-card-title flex items-center gap-2"><History size={16} className="text-[var(--accent)]" aria-hidden="true" /> Version history</h2>
      <p className="mt-1 text-xs leading-6 text-[var(--muted)]">Your saved drafts and previously published versions.</p>
      {msg && <p role="status" className="mt-2 text-sm text-slate-600 dark:text-slate-300">{msg}</p>}
      {isLoading && <div className="mt-4"><Spinner label="Loading versions…" /></div>}
      {data && data.results.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-[var(--line)] p-4 text-xs leading-6 text-[var(--muted)]">No saved versions yet. Save your first checkpoint above to start your history.</p>}
      <ul className="site-editor-history-list">
        {data?.results.map((v) => (
          <li key={v.id}>
            <span className="text-xs font-semibold">v{v.version_no}</span>
            <Badge tone={v.status === "published" ? "green" : "slate"}>{v.status}</Badge>
            <span className="min-w-0 flex-1 basis-24 break-words text-xs text-[var(--muted)]">{v.note || new Date(v.created_at).toLocaleString()}</span>
            <span className="ml-auto flex flex-wrap gap-1">
              {v.status !== "published" && (
                <Button
                  onClick={() => act(publish.mutateAsync(v.id), `Published v${v.version_no}.`)}
                  disabled={publish.isPending || rollback.isPending}
                  className="!min-h-8 !px-2 !text-[10px]"
                >
                  Publish
                </Button>
              )}
              <Button
                onClick={() => {
                  if (window.confirm(`Roll back the live site to v${v.version_no}?`)) {
                    act(rollback.mutateAsync(v.id), `Rolled back to v${v.version_no}.`);
                  }
                }}
                disabled={publish.isPending || rollback.isPending}
                className="!min-h-8 !px-2 !text-[10px]"
              >
                Rollback
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ResetDraftButton({ siteId, onDone }: { siteId: number; onDone: () => void }) {
  const reset = useResetDraft(siteId);
  return (
    <Button
      onClick={() => {
        if (window.confirm("Discard unsaved draft changes and restore the published version?")) {
          reset.mutate(undefined, { onSuccess: onDone });
        }
      }}
      disabled={reset.isPending}
      variant="ghost"
    >
      <RotateCcw size={13} aria-hidden="true" />{reset.isPending ? "Resetting…" : "Reset draft to published"}
    </Button>
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
