import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, ArrowUpRight, CheckCircle2, Globe2, Layers, Link2, Plus, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchOverview } from "../api";
import { Badge, Button, Card, CardTitle, EmptyState, PageHeader, Skeleton, StatusDot, timeAgo } from "../../../shared/ui/kit";
import { useAuthStore } from "../../../stores/auth";
import { useBuilderStore } from "../../../stores/builder";

function Stat({ label, value, hint, icon: Icon, tone }: { label: string; value: number; hint: string; icon: LucideIcon; tone: string }) {
  return <Card><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-[var(--muted)]">{label}</span><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span></div><p className="ui-stat-value">{value}</p><p className="mt-2 text-[11px] text-[var(--muted)]">{hint}</p></Card>;
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["overview"], queryFn: fetchOverview });
  const header = <PageHeader title="Workspace overview" eyebrow="A little more perspective" description={`Welcome back${user?.first_name ? `, ${user.first_name}` : ""}. Here's what's happening across your websites.`} actions={<Link className="ui-button" data-variant="primary" to="/websites/new"><Plus size={15} aria-hidden="true" /> Add website</Link>} />;

  if (isLoading) return <div className="space-y-6">{header}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-36" />)}</div><Skeleton className="h-72" /></div>;
  if (isError || !data) return <div className="space-y-6">{header}<EmptyState title="Your overview couldn't load" hint="Check your connection, then give it another try." action={<Button onClick={() => void refetch()}>Try again</Button>} /></div>;

  const { sites, site_creation_by_day, sites_by_status, recent_sites } = data;
  const statusColors: Record<string, string> = { active: "#3b82f6", pending: "#f59e0b", inactive: "#cbd5e1" };
  const statusChart = sites_by_status.map((item) => ({ name: item.status, value: item.count }));
  const connectionStats = [
    { label: "Connected websites", value: sites.connected, icon: Link2 },
    { label: "Built on this platform", value: sites.built, icon: Layers },
    { label: "Connector script", value: sites.connector_mode, icon: Globe2 },
    { label: "Reverse proxy", value: sites.proxy_mode, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {header}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total websites" value={sites.total} hint="Your entire website portfolio" icon={Globe2} tone="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300" />
        <Stat label="Live websites" value={sites.active} hint={`${sites.pending} pending · ${sites.inactive} inactive`} icon={Activity} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300" />
        <Stat label="Verified domains" value={sites.verified} hint={`${sites.unverified} awaiting verification`} icon={ShieldCheck} tone="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300" />
        <Stat label="Ready for a next step" value={sites.built_not_published} hint="Built websites that aren't live yet" icon={Layers} tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Your portfolio, growing</CardTitle><p className="mt-1 text-xs text-[var(--muted)]">Websites created over the last 14 days</p></div><Badge tone="blue">Last 14 days</Badge></div>
          <div className="mt-6 h-60" role="img" aria-label="Area chart of websites created over the last 14 days">
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={site_creation_by_day} margin={{ top: 8, right: 12, left: -25, bottom: 0 }}>
              <defs><linearGradient id="website-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.22} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0.015} /></linearGradient></defs>
              <CartesianGrid vertical={false} strokeDasharray="4 5" /><XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={28} tick={{ fontSize: 10 }} tickMargin={12} tickFormatter={(value: string) => value.slice(5)} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} /><Tooltip labelFormatter={(label) => `Date: ${label}`} /><Area type="monotone" dataKey="count" name="Websites created" stroke="#3b82f6" strokeWidth={2.5} fill="url(#website-area)" isAnimationActive={false} activeDot={{ r: 4, strokeWidth: 3, stroke: "#fff" }} />
            </AreaChart></ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardTitle>Website status</CardTitle><p className="mt-1 text-xs text-[var(--muted)]">A snapshot of your portfolio</p>
          <div className="relative mx-auto mt-4 h-44 max-w-[240px]" role="img" aria-label={`${sites.active} active, ${sites.pending} pending, ${sites.inactive} inactive websites`}>
            {sites.total > 0 ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={57} outerRadius={74} paddingAngle={5} stroke="none" isAnimationActive={false}>{statusChart.map((item) => <Cell key={item.name} fill={statusColors[item.name] ?? "#94a3b8"} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border-[17px] border-[var(--line)]" />}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-semibold tracking-tight">{sites.total}</span><span className="mt-1 text-[10px] text-[var(--muted)]">Total websites</span></div>
          </div>
          <div className="mt-4 space-y-3">{[{ name: "Active", count: sites.active, color: "bg-blue-500" }, { name: "Pending", count: sites.pending, color: "bg-amber-400" }, { name: "Inactive", count: sites.inactive, color: "bg-slate-300" }].map((item) => <div key={item.name} className="flex items-center gap-2 text-xs"><span className={`h-2 w-2 rounded-full ${item.color}`} /><span className="text-[var(--muted)]">{item.name}</span><span className="ml-auto font-semibold tabular-nums">{item.count}</span></div>)}</div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[{ to: "/builder/new", icon: Layers, title: "Bring an idea to life", text: "Build a website from a starter template." }, { to: "/websites/new", icon: Link2, title: "Connect a website", text: "Manage an existing site from here." }, { to: "/monitoring", icon: Activity, title: "Keep an eye on things", text: "Check uptime, SSL, and connectors." }].map((item) => <Link key={item.to} to={item.to} className="ui-action-card"><span className="ui-icon-well"><item.icon size={20} strokeWidth={1.7} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{item.title}</span><span className="mt-1 block text-[11px] leading-5 text-[var(--muted)]">{item.text}</span></span><ArrowUpRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" /></Link>)}
      </div>

      <Card>
        <div className="mb-5 flex items-center justify-between"><div><CardTitle>Recent websites</CardTitle><p className="mt-1 text-xs text-[var(--muted)]">Pick up where you left off.</p></div><Link to="/websites" className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)]">View all <ArrowRight size={13} aria-hidden="true" /></Link></div>
        {recent_sites.length === 0 ? <EmptyState title="Your first website starts here" hint="Build something new or connect a website you already own." action={<Link className="ui-button" data-variant="primary" to="/websites/new"><Plus size={14} /> Add website</Link>} /> : <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Website</th><th>Type</th><th>Verification</th><th>Status</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{recent_sites.map((site) => <tr key={site.id}><td><div className="flex items-center gap-3"><span className="ui-icon-well !h-9 !w-9 !rounded-lg text-xs font-semibold">{site.name.slice(0, 2).toUpperCase()}</span><div><p className="font-semibold">{site.name}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{site.domain}</p></div></div></td><td><Badge tone={site.type === "built" ? "blue" : "slate"}>{site.type}</Badge></td><td><Badge tone={site.verification_status === "verified" ? "green" : site.verification_status === "failed" ? "red" : "amber"}>{site.verification_status}</Badge></td><td><Badge tone={site.status === "active" ? "green" : "slate"}>{site.status}</Badge></td><td className="whitespace-nowrap text-[var(--muted)]">{timeAgo(site.created_at)}</td><td><Link to={site.type === "built" ? "/builder/pages" : `/websites/${site.id}/edit`} onClick={() => { if (site.type === "built") useBuilderStore.getState().setSiteId(site.id); }} className="ui-button" data-variant="secondary">Open <ArrowUpRight size={12} aria-hidden="true" /></Link></td></tr>)}</tbody></table></div>}
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card><CardTitle>How your sites connect</CardTitle><div className="mt-5 space-y-4">{connectionStats.map((item) => <div key={item.label} className="flex items-center gap-2.5 text-xs"><item.icon size={15} className="text-[var(--muted)]" aria-hidden="true" /><span className="text-[var(--muted)]">{item.label}</span><span className="ml-auto font-semibold tabular-nums">{item.value}</span></div>)}</div></Card>
        <Card><CardTitle>Ownership & verification</CardTitle><div className="mt-5 space-y-4">{[{ name: "Verified", count: sites.verified, color: "bg-emerald-500" }, { name: "Awaiting verification", count: sites.unverified, color: "bg-amber-400" }, { name: "Failed verification", count: sites.failed_verification, color: "bg-rose-400" }].map((item) => <div key={item.name}><div className="mb-2 flex justify-between text-xs"><span className="text-[var(--muted)]">{item.name}</span><span className="font-semibold">{item.count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${sites.total ? Math.min(100, item.count / sites.total * 100) : 0}%` }} /></div></div>)}</div></Card>
        <Card><div className="flex items-center justify-between"><CardTitle>Platform services</CardTitle><Sparkles size={16} className="text-[var(--accent)]" aria-hidden="true" /></div><div className="mt-5 space-y-4">{[{ label: "Database", status: data.system.db }, { label: "Cache", status: data.system.redis }, { label: "Background worker", status: data.system.celery }].map((service) => <div key={service.label} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-[var(--muted)]">{service.label}</span><StatusDot status={service.status} /></div>)}</div><p className="ui-section-divider flex items-center gap-1.5 text-[10px] text-[var(--muted)]"><CheckCircle2 size={12} aria-hidden="true" /> {data.beat_schedules} scheduled background jobs</p></Card>
      </div>
    </div>
  );
}
