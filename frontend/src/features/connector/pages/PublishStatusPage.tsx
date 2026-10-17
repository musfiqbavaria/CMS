import { useState } from "react";
import { Activity, ArrowRight, Check, CircleAlert, Clock3, ExternalLink, Radio, RefreshCw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useSite } from "../../sites/api";
import { publicSiteUrl } from "../../sites/links";
import { Badge, Button, Card, PageHeader, Skeleton, timeAgo } from "../../../shared/ui/kit";
import { useDeliveryStatus, type DeliveryStatus } from "../delivery";
import { cmsOrigin, isLocalCmsOrigin } from "../snippet";
import "./publish-status.css";

const STATES: Record<DeliveryStatus["state"], { label: string; tone: "green" | "amber" | "blue" | "red" | "slate" }> = {
  reported: { label: "Current version reported", tone: "green" },
  partial: { label: "Some fields need attention", tone: "amber" },
  error: { label: "Application error", tone: "red" },
  outdated: { label: "Different version reported", tone: "amber" },
  changed: { label: "Changes awaiting a report", tone: "amber" },
  stale: { label: "No recent report", tone: "slate" },
  waiting: { label: "Waiting for the website", tone: "blue" },
  unpublished: { label: "Nothing published yet", tone: "slate" },
  unverified: { label: "Ownership verification needed", tone: "amber" },
  inactive: { label: "Website inactive", tone: "slate" },
  unsupported: { label: "Connected websites only", tone: "slate" },
};

const versionLabel = (version: number | null | undefined) => version == null ? "Not reported" : `v${version}`;
const fullTime = (value: string) => new Date(value).toLocaleString();

export default function PublishStatusPage() {
  const { id } = useParams();
  const siteId = Number(id);
  const validId = Number.isInteger(siteId) && siteId > 0 ? siteId : null;
  const siteQuery = useSite(validId);
  const delivery = useDeliveryStatus(validId);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const site = siteQuery.data;
  const data = delivery.data;

  if (siteQuery.isLoading || delivery.isLoading) return <div className="space-y-4" aria-label="Loading publish status"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (siteQuery.isError || delivery.isError || !site || !data) return (
    <Card>
      <h1 className="font-semibold">Publish status is unavailable</h1>
      <p role="alert" className="mt-2 text-sm text-[var(--muted)]">We couldn’t load this website’s reports. Check your connection and access to this website.</p>
      <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => { void siteQuery.refetch(); void delivery.refetch(); }}>Try again</Button><Link className="ui-button" data-variant="ghost" to="/websites">Back to websites</Link></div>
    </Card>
  );

  const state = STATES[data.state];
  const latest = data.latest_report;
  const selected = data.recent_reports.find((report) => report.id === selectedId) ?? latest;
  const issues = selected ? selected.unmatched.length + selected.errors.length : 0;
  const localOnly = isLocalCmsOrigin(cmsOrigin(site.connector_origin));
  const label = (key: string) => data.field_labels[key] ?? key.replace(/_/g, " ");

  return (
    <div className="publish-status space-y-5">
      <Link to="/websites" className="text-sm text-[var(--muted)] hover:underline">← Websites</Link>
      <PageHeader title="Publish status" eyebrow="From your CMS to your website" description={`${site.name} · ${site.domain}`} actions={
        <>
          <Link to={`/websites/${siteId}/edit`} className="ui-button" data-variant="secondary">Back to editor</Link>
          <Button onClick={() => void delivery.refetch()} disabled={delivery.isFetching}><RefreshCw size={15} aria-hidden="true" className={delivery.isFetching ? "animate-spin motion-reduce:animate-none" : ""} />Refresh reports</Button>
          <a href={publicSiteUrl(site.public_url || site.domain)} target="_blank" rel="noopener noreferrer" className="ui-button" data-variant="primary">Open website<ExternalLink size={14} aria-hidden="true" /></a>
        </>
      } />

      <section className="delivery-banner" data-tone={state.tone} aria-label="Delivery summary">
        <span className="delivery-signal" aria-hidden="true">{data.state === "reported" ? <Check size={24} /> : data.state === "error" || data.state === "partial" ? <CircleAlert size={24} /> : <Radio size={24} />}</span>
        <div className="min-w-0 flex-1"><Badge tone={state.tone}>{state.label}</Badge><h2 className="mt-3 text-lg font-semibold leading-snug">{data.message}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Publishing saves the version in this CMS. A report arrives only after a website browser loads the connector and sends its results back.</p></div>
        <div className="delivery-updated"><Activity size={14} aria-hidden="true" />Checks every 10s while visible<span title={fullTime(data.checked_at)}>Updated {timeAgo(data.checked_at)}</span></div>
      </section>

      {localOnly && <div role="note" className="delivery-note"><CircleAlert size={18} aria-hidden="true" /><p><strong>Local testing mode.</strong> Public visitors cannot reach a CMS running on your computer’s localhost. On this computer, browser security may also block the connection. <Link to={`/websites/${siteId}/setup`} className="underline">Check connector setup</Link> if no report arrives.</p></div>}

      <div className="delivery-metrics">
        <Card><p className="delivery-label">Published in CMS</p><p className="delivery-value">{data.published_version == null ? "Not published" : versionLabel(data.published_version)}</p><p className="delivery-caption">The version available to the connector</p></Card>
        <Card><p className="delivery-label">Website browser reported</p><p className="delivery-value">{versionLabel(latest?.version)}</p><p className="delivery-caption">Excludes CMS preview reports</p></Card>
        <Card><p className="delivery-label">Last website report received</p><p className="delivery-value" title={latest ? fullTime(latest.received_at) : undefined}>{latest ? timeAgo(latest.received_at) : "Waiting"}</p><p className="delivery-caption">{latest ? fullTime(latest.received_at) : "Reload the website to send a report"}</p></Card>
        <Card><p className="delivery-label">Latest website result</p><p className="delivery-value">{latest ? `${latest.applied.length} applied` : "No report"}</p><p className="delivery-caption">{latest ? `${latest.unmatched.length + latest.errors.length} field issues reported` : "No success assumed"}</p></Card>
      </div>

      <div className="delivery-details-grid">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="ui-card-title">Field delivery details</h2><p className="mt-1 text-sm text-[var(--muted)]">What this page load actually reported.</p></div>{selected && <Badge tone={selected.context === "preview" ? "slate" : "blue"}>{selected.context === "preview" ? "CMS preview · not live" : "Website browser"}</Badge>}</div>
          {selected ? <>
            <div className="delivery-report-meta"><span className="font-semibold">{versionLabel(selected.version)}</span><code className="break-all">{selected.page_path}</code><span title={fullTime(selected.received_at)}>{timeAgo(selected.received_at)}</span></div>
            {selected.context === "preview" && <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">This is a preview report. It does not confirm delivery on the actual website.</p>}
            {issues > 0 && <div className="mb-5 space-y-3" aria-label="Fields needing attention">
              {selected.unmatched.map((field, index) => <div key={`missing-${index}`} className="delivery-issue"><p className="font-semibold">{label(field.key)}</p><p className="mt-1 text-sm">No matching website element found.</p><code className="mt-2 block break-all text-xs">{field.selector || "No selector provided"}</code></div>)}
              {selected.errors.map((error, index) => <div key={`error-${index}`} className="delivery-issue"><p className="font-semibold">{label(error.key)}</p><p className="mt-1 break-words text-sm">{error.message || "The browser reported an application error."}</p></div>)}
              <Link to={`/websites/${siteId}/mappings`} className="ui-button" data-variant="secondary">Review selector mappings<ArrowRight size={14} aria-hidden="true" /></Link>
            </div>}
            {selected.applied.length > 0 && <div><h3 className="delivery-label mb-3">Reported as applied</h3><div className="flex flex-wrap gap-2">{selected.applied.map((key) => <Badge key={key} tone="green"><Check size={12} aria-hidden="true" />{label(key)}</Badge>)}</div></div>}
            {issues === 0 && selected.state === "ready" && <p className="mt-4 text-sm text-[var(--muted)]">No field issues reported for this page load.</p>}
            <p className="mt-5 border-t border-[var(--line)] pt-4 text-xs leading-5 text-[var(--muted)]">“Applied” means the connector updated the page’s elements. It does not verify image downloads, visual appearance, search engine indexing, or every visitor’s browser.</p>
          </> : <div className="delivery-empty"><Radio size={30} aria-hidden="true" /><h3 className="mt-3 font-semibold">No website report yet</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">Open the website in a new tab, reload it, then return here. Missing reports do not mean publishing succeeded or failed.</p></div>}
        </Card>

        <Card>
          <h2 className="ui-card-title">Check the connection</h2>
          <ol className="delivery-steps">
            <li><span>1</span><div><h3>Publish your changes</h3><p>Save a version from the website editor.</p><Link to={`/websites/${siteId}/edit`}>Open editor<ArrowRight size={13} aria-hidden="true" /></Link></div></li>
            <li><span>2</span><div><h3>Load the actual website</h3><p>The installed connector must be able to reach this CMS. Previewing here is a separate check.</p></div></li>
            <li><span>3</span><div><h3>Review what arrived</h3><p>Compare versions, then fix missing selectors or application errors.</p><Link to={`/websites/${siteId}/setup`}>Connection setup<ArrowRight size={13} aria-hidden="true" /></Link></div></li>
          </ol>
          {data.state === "unverified" && <Link className="ui-button mt-4" data-variant="secondary" to={`/websites/${siteId}/verify`}>Verify website ownership</Link>}
          <p className="delivery-footnote"><Clock3 size={15} aria-hidden="true" />A report is considered recent for {Math.round(data.fresh_for_seconds / 60)} minutes. No background heartbeat is assumed.</p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="ui-card-title">Recent browser reports</h2><p className="mt-1 text-sm text-[var(--muted)]">Latest 20 observations. Select a report to inspect its fields above.</p></div><Badge tone="slate">{data.recent_reports.length} reports</Badge></div>
        {data.recent_reports.length ? <div className="delivery-table-wrap"><table className="delivery-table"><thead><tr><th scope="col">Page / source</th><th scope="col">Version</th><th scope="col">Result</th><th scope="col">Received</th><th scope="col"><span className="sr-only">Inspect report</span></th></tr></thead><tbody>{data.recent_reports.map((report) => <tr key={report.id} data-selected={selected?.id === report.id}>
          <td><code className="block max-w-xs break-all text-xs">{report.page_path}</code><span className="mt-1 block text-xs text-[var(--muted)]">{report.context === "preview" ? "CMS preview · not live" : "Website browser"}</span></td><td>{versionLabel(report.version)}</td><td><Badge tone={report.state === "ready" ? "green" : report.state === "error" ? "red" : "amber"}>{report.state === "ready" ? "Applied" : report.state === "error" ? "Error" : "Partial"}</Badge></td><td title={fullTime(report.received_at)}>{timeAgo(report.received_at)}</td><td><Button variant="ghost" aria-label={`Inspect report ${report.id}`} aria-pressed={selected?.id === report.id} onClick={() => setSelectedId(report.id)}>Inspect<ArrowRight size={13} aria-hidden="true" /></Button></td>
        </tr>)}</tbody></table></div> : <p className="py-8 text-center text-sm text-[var(--muted)]">No browser observations have been received.</p>}
        {data.latest_preview && !latest && <p className="mt-3 text-sm text-[var(--muted)]">A CMS preview has reported, but no browser on the actual website has reported yet.</p>}
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Reports are browser observations, not an independent deployment audit. Query strings and URL fragments are not stored. History is limited to 200 reports per website.</p>
      </Card>
    </div>
  );
}
