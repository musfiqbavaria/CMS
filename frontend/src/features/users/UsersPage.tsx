import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../shared/api/client";
import { useAuthStore } from "../../stores/auth";
import { Badge, Button, Card, CardTitle, EmptyState, Skeleton, PageHeader } from "../../shared/ui/kit";
import { Plus } from "lucide-react";

interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_2fa_enabled: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

export default function UsersPage() {
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "admin" });

  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ results: AdminUser[] }>("/v1/users/?page_size=100").then((r) => r.data.results),
  });

  function fail(e: unknown) {
    const data = (e as { response?: { data?: unknown } }).response?.data;
    setMsg({ kind: "err", text: typeof data === "object" && data ? JSON.stringify(data) : "Request failed." });
  }

  const patch = useMutation({
    mutationFn: ({ id, ...p }: { id: number } & Record<string, unknown>) =>
      api.patch(`/v1/users/${id}/`, p).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/v1/users/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setMsg({ kind: "ok", text: "User deleted." });
    },
    onError: fail,
  });
  const create = useMutation({
    mutationFn: () => api.post("/v1/users/", form).then((r) => r.data),
    onSuccess: () => {
      setShowNew(false);
      setForm({ username: "", email: "", password: "", role: "admin" });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: fail,
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Users & roles" description="Manage your team and the people who keep your websites moving." eyebrow="Your workspace, together" actions={<Button variant="primary" onClick={() => setShowNew((value) => !value)}><Plus size={14} aria-hidden="true" />{showNew ? "Close form" : "Add user"}</Button>} />
      {msg && (
        <p role={msg.kind === "ok" ? "status" : "alert"} className={`rounded p-2 text-sm ${msg.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text} <button onClick={() => setMsg(null)} className="underline">Dismiss</button>
        </p>
      )}
      {showNew && (
        <Card>
          <CardTitle>New admin user</CardTitle>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className="rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
            <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" type="password" className="rounded border p-2 dark:border-slate-600 dark:bg-slate-700" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded border p-2 dark:border-slate-600 dark:bg-slate-700">
              <option value="admin">admin</option>
              <option value="superadmin">superadmin</option>
            </select>
          </div>
          <button onClick={() => create.mutate()} disabled={create.isPending} className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">
            Create
          </button>
        </Card>
      )}
      {users.isLoading ? (
        <Skeleton className="h-48" />
      ) : users.isError ? (
        <EmptyState title="Your team couldn't load" hint="Check your connection, then try again." action={<Button onClick={() => void users.refetch()}>Try again</Button>} />
      ) : (
        <Card>
          <div className="mb-5 flex items-center justify-between gap-2"><CardTitle>Workspace members</CardTitle><Badge tone="slate">{users.data?.length ?? 0} members</Badge></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="py-2 pr-3 font-medium">User</th>
                  <th className="py-2 pr-3 font-medium">Role</th>
                  <th className="py-2 pr-3 font-medium">2FA</th>
                  <th className="py-2 pr-3 font-medium">Active</th>
                  <th className="py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(users.data ?? []).map((u) => {
                  const isSelf = me?.id === u.id;
                  return (
                    <tr key={u.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                      <td className="py-2 pr-3">
                        <p className="font-medium">{u.username}{isSelf && " (you)"}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          aria-label={`Role for ${u.username}`}
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) => patch.mutate({ id: u.id, role: e.target.value })}
                          className="rounded border p-1 text-xs disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700"
                        >
                          <option value="admin">admin</option>
                          <option value="superadmin">superadmin</option>
                        </select>
                      </td>
                      <td className="py-2 pr-3"><Badge tone={u.is_2fa_enabled ? "green" : "slate"}>{u.is_2fa_enabled ? "Enabled" : "Not enabled"}</Badge></td>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          aria-label={`Active ${u.username}`}
                          checked={u.is_active}
                          disabled={isSelf}
                          onChange={(e) => patch.mutate({ id: u.id, is_active: e.target.checked })}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          disabled={isSelf}
                          onClick={() => { if (window.confirm(`Delete ${u.username}?`)) remove.mutate(u.id); }}
                          className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
