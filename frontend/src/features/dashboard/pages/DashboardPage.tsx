import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardTitle } from "../../../shared/ui/kit";

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
          <Card key={i} className="h-28">
            <CardTitle>{i + 1}</CardTitle>
          </Card>
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
    </div>
  );
}