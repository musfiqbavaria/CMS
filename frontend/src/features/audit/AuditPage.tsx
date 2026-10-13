import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../shared/api/client";
import { Card, Skeleton } from "../../shared/ui/kit";
import type { Paged } from "../sites/types";

interface AuditEntry {
  id: number;
  actor_username: string | null;
  action: string;
  model: string;
  object_id: string;
  site: number | null;
  site_display: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  created_at: string;
}

const ACTIONS = ["created", "updated", "deleted", "activated", "deactivated", "verified", "published", "rolled_back"];

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [site, setSite] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [search, setSearch] = useState("");

  const sites = useQuery({
    queryKey: ["sites-all"],
    queryFn: () => api.get<{ results: { id: number; domain: string }[] }>("/v1/sites/?page_size=100").then((r) => r.data.results),
  });
  const users = useQuery({
    queryKey: ["users-all"],
    queryFn: () => api.get<{ results: { id: number; username: string }[] }>("/v1/users/?page_size=100").then((r) => r.data.results),
  });

  const q = new URLSearchParams({ page: String(page), page_size: "25" });
  if (site) q.set("site", site);
  if (action) q.set("action", action);
  if (actor) q.set("actor", actor);
  if (search.trim()) q.set("search", search.trim());

  const logs = useQuery({
    queryKey: ["audit-logs", page, site, action, actor, search],
    queryFn: () => api.get<Paged<AuditEntry>>(`/v1/audit/logs/?${q.toString()}`).then((r) => r.data),
  });

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <Card>
        <div className="flex flex-wrap gap-2">
          <select value={site} onChange={(e) => { setSite(e.target.value); resetPage(); }} className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700">
            <option value="">All sites</option>
            {(sites.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.domain}</option>
            ))}
          </select>
          <select value={action} onChange={(e) => { setAction(e.target.value); resetPage(); }} className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700">
            <option value="">All actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select value={actor} onChange={(e) => { setActor(e.target.value); resetPage(); }} className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700">
            <option value="">All actors</option>
            {(users.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>
          <input value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} placeholder="Search domain…" className="min-w-40 flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700" />
        </div>

        <div className="mt-3">
          {logs.isLoading ? (
            <Skeleton className="h-40" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Actor</th>
                    <th className="py-2 pr-3 font-medium">Action</th>
                    <th className="py-2 pr-3 font-medium">Target</th>
                    <th className="py-2 font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {(logs.data?.results ?? []).map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 align-top last:border-0 dark:border-slate-700">
                      <td className="whitespace-nowrap py-2 pr-3">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-3">{e.actor_username ?? "system"}</td>
                      <td className="py-2 pr-3">
                        <span className="rounded bg-slate-100 px-1.5 text-xs capitalize dark:bg-slate-700">{e.action}</span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{e.site_display || `${e.model}#${e.object_id}`}</td>
                      <td className="py-2 font-mono text-xs text-slate-500">
                        {changedLines(e.before, e.after).slice(0, 4).map((l) => (
                          <p key={l} className="truncate">{l}</p>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {(logs.data?.results ?? []).length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-slate-500">No entries match.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {(logs.data?.count ?? 0) > 0 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <p className="text-slate-500">Page {page} · {logs.data?.count} total</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Prev</button>
              <button disabled={!logs.data?.next} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function changedLines(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  return keys
    .filter((k) => JSON.stringify((before ?? {})[k]) !== JSON.stringify((after ?? {})[k]))
    .map((k) => `${k}: ${JSON.stringify((before ?? {})[k])} → ${JSON.stringify((after ?? {})[k])}`);
}
