import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchOverview } from "../api";
import { Card, CardTitle, Skeleton, StatusDot } from "../../../shared/ui/kit";

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardTitle>{label}</CardTitle>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["overview"], queryFn: fetchOverview });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <p className="text-sm text-red-600">Could not load dashboard data.</p>
        <button onClick={() => refetch()} className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
          Retry
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Websites" value={data.sites.total} hint={`${data.sites.active} active`} />
          <Stat label="Connected" value={data.sites.connected} hint="External domains" />
          <Stat label="Built" value={data.sites.built} hint="CMS-built sites" />
          <Stat label="Verified" value={data.sites.verified} hint={`${data.sites.pending} pending`} />
        </div>

        <Card>
          <CardTitle>Recent websites</CardTitle>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Domain</th>
                  <th className="py-2 pr-4 font-medium">Type</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_sites.map((site) => (
                  <tr key={site.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                    <td className="py-2 pr-4 font-medium">
                      <Link to={`/websites/${site.id}/edit`} className="hover:underline">{site.name}</Link>
                    </td>
                    <td className="py-2 pr-4">{site.domain}</td>
                    <td className="py-2 pr-4 capitalize">{site.type}</td>
                    <td className="py-2 capitalize">{site.status}</td>
                  </tr>
                ))}
                {data.recent_sites.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">
                      No websites yet. <Link to="/websites/new" className="underline">Add one</Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Admin users" value={data.users.total} hint={`${data.users.active} active`} />
        <Stat label="Locked accounts" value={data.users.locked} hint="Failed-login lockouts" />
        <Stat label="2FA enabled" value={data.users.two_fa_enabled} hint="Accounts with TOTP" />
        <Stat label="Beat schedules" value={data.beat_schedules} hint="db-backed periodic tasks" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle>Signups — last 14 days</CardTitle>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.signups_by_day}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" name="signups" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>System status</CardTitle>
          <ul className="mt-3 space-y-2">
            <li className="flex justify-between text-sm">
              <span>Database</span>
              <StatusDot status={data.system.db} />
            </li>
            <li className="flex justify-between text-sm">
              <span>Redis</span>
              <StatusDot status={data.system.redis} />
            </li>
            <li className="flex justify-between text-sm">
              <span>Celery worker</span>
              <StatusDot status={data.system.celery} />
            </li>
          </ul>
          <div className="mt-4 rounded bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            Website, health-check and audit cards are available from the sidebar.
            <Link to="/websites" className="ml-1 underline">
              Preview the Websites page
            </Link>
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Recent users</CardTitle>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700">
                <th className="py-2 pr-4 font-medium">Username</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">2FA</th>
                <th className="py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                  <td className="py-2 pr-4 font-medium">{u.username}</td>
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4">{u.role}</td>
                  <td className="py-2 pr-4">{u.is_2fa_enabled ? "On" : "Off"}</td>
                  <td className="py-2">{new Date(u.date_joined).toLocaleDateString()}</td>
                </tr>
              ))}
              {data.recent_users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
