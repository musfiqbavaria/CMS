import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../shared/api/client";
import { Card, CardTitle, Skeleton, StatusDot } from "../../shared/ui/kit";

interface CheckSummary {
  site: number;
  name: string;
  domain: string;
  type: string;
  overall: "ok" | "fail" | "unknown";
  hosts: Record<string, Record<string, string>>;
  checks: Record<string, { status: string; checked_at: string | null; response_ms: number | null; detail: Record<string, unknown>; hosts?: string[] } | null>;
}

interface HistoryRow {
  id: number;
  check_type: string;
  host: string;
  status: string;
  detail: Record<string, unknown>;
  checked_at: string;
}

const CHECK_LABELS: Record<string, string> = { uptime: "Uptime", ssl: "SSL", connector: "Connector" };

export default function MonitoringPage() {
  const [siteId, setSiteId] = useState<number | null>(null);
  const sites = useQuery({
    queryKey: ["sites-all"],
    queryFn: () => api.get<{ results: { id: number; name: string; domain: string }[] }>("/v1/sites/?page_size=100").then((r) => r.data.results),
  });
  const summary = useQuery({
    queryKey: ["monitoring-summary"],
    queryFn: () => api.get<CheckSummary[]>("/v1/monitoring/summary/").then((r) => r.data),
    refetchInterval: 30000,
  });
  const history = useQuery({
    queryKey: ["monitoring-history", siteId],
    queryFn: () =>
      api
        .get<{ results: HistoryRow[] }>(
          `/v1/monitoring/checks/?${siteId ? `site=${siteId}&` : ""}page_size=20`,
        )
        .then((r) => r.data.results),
    enabled: siteId !== null,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Monitoring</h1>
      <p className="text-sm text-slate-500">
        Uptime every 5 min · SSL + connector presence daily. Failures notify here live.
      </p>
      {summary.isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        <Card>
          <CardTitle>Site status</CardTitle>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="py-2 pr-4 font-medium">Site</th>
                  <th className="py-2 pr-4 font-medium">Overall</th>
                  <th className="py-2 pr-4 font-medium">Uptime</th>
                  <th className="py-2 pr-4 font-medium">SSL</th>
                  <th className="py-2 font-medium">Connector</th>
                </tr>
              </thead>
              <tbody>
                {(summary.data ?? []).map((row) => (
                  <tr key={row.site} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                    <td className="py-2 pr-4">
                      <Link to={`/websites/${row.site}/setup`} className="font-medium underline">{row.name}</Link>
                      <span className="ml-2 font-mono text-xs text-slate-500">{row.domain}</span>
                      {Object.keys(row.hosts ?? {}).length > 1 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(row.hosts).map(([host, states]) => (
                            <span key={host} title={host} className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              <StatusDot status={states.overall === "ok" ? "ok" : "error"} />
                              {host}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4"><StatusDot status={row.overall === "fail" ? "error" : row.overall} /></td>
                    {["uptime", "ssl", "connector"].map((k) => (
                      <td key={k} className="py-2 pr-4" title={row.checks[k]?.checked_at ? new Date(row.checks[k]?.checked_at as string).toLocaleString() : "never checked"}>
                        {row.checks[k] ? <StatusDot status={row.checks[k]?.status === "ok" ? "ok" : "error"} /> : <span className="text-slate-400">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                {(summary.data ?? []).length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-slate-500">No active sites yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Recent checks</CardTitle>
        <label className="mt-2 flex max-w-md items-center gap-2 text-sm">
          <span className="font-medium">Site</span>
          <select value={siteId ?? ""} onChange={(e) => setSiteId(e.target.value ? Number(e.target.value) : null)} className="flex-1 rounded border p-2 dark:border-slate-600 dark:bg-slate-700">
            <option value="">Select a site…</option>
            {(sites.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.domain})</option>
            ))}
          </select>
        </label>
        {!siteId ? (
          <p className="mt-2 text-sm text-slate-500">Choose a site to inspect its check history.</p>
        ) : history.isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {(history.data ?? []).map((c) => (
              <li key={c.id} className="flex gap-2">
                <StatusDot status={c.status === "ok" ? "ok" : "error"} />
                <span className="font-medium">{CHECK_LABELS[c.check_type] ?? c.check_type}</span>
                {c.host && <span className="font-mono text-xs text-slate-500">{c.host}</span>}
                <span className="text-slate-500">{new Date(c.checked_at).toLocaleString()}</span>
                <span className="truncate font-mono text-xs text-slate-500">{JSON.stringify(c.detail)}</span>
              </li>
            ))}
            {(history.data ?? []).length === 0 && <li className="text-sm text-slate-500">No checks recorded yet.</li>}
          </ul>
        )}
      </Card>
    </div>
  );
}
