import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useBulkSites,
  useCreateSite,
  useDeleteSite,
  useSetSiteStatus,
  useSites,
} from "../api";
import type { Site, SiteListParams } from "../types";
import type { SiteSchemaValues } from "../schemas";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import HistoryModal from "../components/HistoryModal";
import SiteFormModal from "../components/SiteFormModal";
import { StatusBadge, TypeBadge, VerificationBadge } from "../components/StatusBadge";
import { Card, Skeleton } from "../../../shared/ui/kit";

const PAGE_SIZES = [10, 25, 50];

function serverMessage(err: unknown): string {
  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (data && typeof data === "object") {
    const first = Object.values(data as Record<string, unknown>)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return "Request failed. Try again.";
}

type SortKey = "name" | "domain" | "created_at";

export default function SitesPage({ startWithNew = false }: { startWithNew?: boolean }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [formOpen, setFormOpen] = useState(startWithNew);
  const [deleting, setDeleting] = useState<Site | null>(null);
  const [historySite, setHistorySite] = useState<Site | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const params: SiteListParams = useMemo(
    () => ({
      page,
      page_size: pageSize,
      search: search || undefined,
      type: typeFilter || undefined,
      status: statusFilter || undefined,
      ordering: `${sortDir === "desc" ? "-" : ""}${sortKey}`,
    }),
    [page, pageSize, search, typeFilter, statusFilter, sortKey, sortDir],
  );

  const { data, isLoading, isError, refetch } = useSites(params);
  const createSite = useCreateSite();
  const deleteSite = useDeleteSite();
  const setStatus = useSetSiteStatus();
  const bulk = useBulkSites();

  const totalPages = data ? Math.max(1, Math.ceil(data.count / pageSize)) : 1;

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function sortMark(key: SortKey) {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  function openNew() {
    setFormError(null);
    setFormOpen(true);
  }

  function submitForm(values: SiteSchemaValues) {
    setFormError(null);
    createSite.mutate(values, {
      onSuccess: (site) => {
        setFormOpen(false);
        if (site.type === "connected") {
          navigate(`/websites/${site.id}/verify`);
        } else {
          setPage(1);
          setBanner({ kind: "ok", text: `Added ${site.domain}.` });
        }
      },
      onError: (e) => setFormError(serverMessage(e)),
    });
  }

  function toggleStatus(site: Site) {
    setStatus.mutate(
      { id: site.id, active: site.status !== "active" },
      {
        onSuccess: (s) => setBanner({ kind: "ok", text: `${s.domain} is now ${s.status}.` }),
        onError: (e) => setBanner({ kind: "err", text: serverMessage(e) }),
      },
    );
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteSite.mutate(deleting.id, {
      onSuccess: () => {
        setDeleting(null);
        setSelection((prev) => {
          const next = new Set(prev);
          next.delete(deleting.id);
          return next;
        });
        setBanner({ kind: "ok", text: `Deleted ${deleting.domain}.` });
      },
      onError: (e) => setBanner({ kind: "err", text: serverMessage(e) }),
    });
  }

  function runBulk(action: "activate" | "deactivate" | "delete") {
    const ids = [...selection];
    bulk.mutate(
      { action, ids },
      {
        onSuccess: (r) => {
          setSelection(new Set());
          setBanner({ kind: "ok", text: `Bulk ${action}: ${r.processed} processed.` });
        },
        onError: (e) => setBanner({ kind: "err", text: serverMessage(e) }),
      },
    );
  }

  function toggleOne(id: number) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    const ids = data?.results.map((s) => s.id) ?? [];
    setSelection((prev) => {
      const all = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (all) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Websites</h1>
        <button onClick={openNew} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900">
          Add website
        </button>
      </div>

      {banner && (
        <p
          role={banner.kind === "ok" ? "status" : "alert"}
          className={`rounded p-2 text-sm ${banner.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}
        >
          {banner.text}
          <button onClick={() => setBanner(null)} className="ml-2 underline">
            Dismiss
          </button>
        </p>
      )}

      <Card>
        <div className="flex flex-wrap gap-2">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or domain…"
            className="min-w-48 flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700"
          />
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700">
            <option value="">All types</option>
            <option value="connected">Connected</option>
            <option value="built">Built</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700">
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>

        {selection.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded bg-slate-100 p-2 text-sm dark:bg-slate-700">
            <span>{selection.size} selected</span>
            <button onClick={() => runBulk("activate")} className="rounded border px-2 py-1 dark:border-slate-500">Activate</button>
            <button onClick={() => runBulk("deactivate")} className="rounded border px-2 py-1 dark:border-slate-500">Deactivate</button>
            <button onClick={() => runBulk("delete")} className="rounded border border-red-300 px-2 py-1 text-red-600">Delete</button>
            <button onClick={() => setSelection(new Set())} className="underline">Clear</button>
          </div>
        )}

        <div className="mt-3 overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : isError || !data ? (
            <div>
              <p className="text-sm text-red-600">Could not load websites.</p>
              <button onClick={() => refetch()} className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
                Retry
              </button>
            </div>
          ) : data.results.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No websites yet. Click “Add website” to register your first domain.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="py-2 pr-2">
                    <input
                      type="checkbox"
                      aria-label="Select all on page"
                      checked={data.results.length > 0 && data.results.every((s) => selection.has(s.id))}
                      onChange={togglePage}
                    />
                  </th>
                  <th className="py-2 pr-4">
                    <button onClick={() => toggleSort("name")} className="font-medium">Site{sortMark("name")}</button>
                  </th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Verification</th>
                  <th className="py-2 pr-4">
                    <button onClick={() => toggleSort("created_at")} className="font-medium">Created{sortMark("created_at")}</button>
                  </th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((site) => (
                  <tr key={site.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${site.domain}`}
                        checked={selection.has(site.id)}
                        onChange={() => toggleOne(site.id)}
                      />
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-200 text-xs font-bold dark:bg-slate-600">
                          {site.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{site.name}</p>
                          <p className="truncate text-xs text-slate-500">{site.domain}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-4"><TypeBadge type={site.type} /></td>
                    <td className="py-2 pr-4"><StatusBadge status={site.status} /></td>
                    <td className="py-2 pr-4"><VerificationBadge status={site.verification_status} /></td>
                    <td className="py-2 pr-4 whitespace-nowrap">{new Date(site.created_at).toLocaleDateString()}</td>
                    <td className="py-2 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1">
                        <Link to={`/websites/${site.id}/edit`} className="rounded border px-2 py-1 text-xs dark:border-slate-600">Edit</Link>
                        <Link to={`/websites/${site.id}/setup`} className="rounded border px-2 py-1 text-xs dark:border-slate-600">Setup</Link>
                        {site.type === "connected" && (
                          <Link to={`/websites/${site.id}/verify`} className="rounded border px-2 py-1 text-xs dark:border-slate-600">
                            Verify
                          </Link>
                        )}
                        <button onClick={() => toggleStatus(site)} className="rounded border px-2 py-1 text-xs dark:border-slate-600">
                          {site.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => setHistorySite(site)} className="rounded border px-2 py-1 text-xs dark:border-slate-600">History</button>
                        <button onClick={() => setDeleting(site)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data && data.count > 0 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <p className="text-slate-500">
              Page {page} of {totalPages} · {data.count} total
            </p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-40 dark:border-slate-600">
                Prev
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-40 dark:border-slate-600">
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      <SiteFormModal
        open={formOpen}
        site={null}
        busy={createSite.isPending}
        serverError={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={submitForm}
      />
      <DeleteConfirmModal
        open={deleting !== null}
        site={deleting}
        busy={deleteSite.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
      <HistoryModal site={historySite} onClose={() => setHistorySite(null)} />
    </div>
  );
}
