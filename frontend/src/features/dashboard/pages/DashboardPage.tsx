import { useQuery } from "@tanstack/react-query";
import { fetchOverview } from "../api";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardTitle, Skeleton } from "../../../shared/ui/kit";

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
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
  });

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

  const { sites, site_creation_by_day, sites_by_status, recent_sites } = data;

  const statusChartData = sites_by_status.map((s) => ({ name: s.status, value: s.count }));
  const verifyChartData = [
    { name: "Verified", value: sites.verified },
    { name: "Unverified", value: sites.unverified },
    { name: "Failed", value: sites.failed_verification },
  ];
  const COLORS = ["#22c55e", "#f59e0b", "#ef4444"];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard – website analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total websites" value={sites.total} hint={`${sites.active} active`} />
        <Stat label="Active" value={sites.active} hint={`${sites.pending} pending`} />
        <Stat label="Inactive" value={sites.inactive} hint="Deactivated or pending" />
        <Stat label="Built but inactive" value={sites.built_not_published} hint="Built sites not published" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Connected sites" value={sites.connected} hint="External domains" />
        <Stat label="Built sites" value={sites.built} hint="CMS-built sites" />
        <Stat label="Verified" value={sites.verified} hint={`${sites.unverified} unverified`} />
        <Stat label="Failed verification" value={sites.failed_verification} hint="Need assistance" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Connector mode" value={sites.connector_mode} hint="using CMS script" />
        <Stat label="Reverse proxy" value={sites.proxy_mode} hint="using redirect" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle>Websites created — last 14 days</CardTitle>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={site_creation_by_day}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" name="websites" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Status distribution</CardTitle>
          <div className="mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {statusChartData.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Verification status</CardTitle>
          <div className="mt-2 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={verifyChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Tip – uptime & SSL status</CardTitle>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            See the Monitoring page for per-site uptime, response time, certification expiry, and live notifications.
            Audit logs and settings are under System.
          </p>
        </Card>
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
                <th className="py-2 pr-4 font-medium">Integration</th>
                <th className="py-2 pr-4 font-medium">Verification</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recent_sites.map((site) => (
                <tr key={site.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                  <td className="py-2 pr-4 font-medium">{site.name}</td>
                  <td className="py-2 pr-4">{site.domain}</td>
                  <td className="py-2 pr-4 capitalize">{site.type}</td>
                  <td className="py-2 pr-4 capitalize">{site.integration_mode}</td>
                  <td className="py-2 pr-4 capitalize">{site.verification_status}</td>
                  <td className="py-2 pr-4 capitalize">{site.status}</td>
                  <td className="py-2">
                    <Link to={`/websites/${site.id}/edit`} className="rounded border px-2 py-1 text-xs">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {recent_sites.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-500">
                    No websites yet. <Link to="/websites/new" className="underline">Add one</Link>
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