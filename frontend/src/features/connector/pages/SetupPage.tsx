import { Link, useParams } from "react-router-dom";
import { useSite } from "../../sites/api";
import { useMappings } from "../api";
import { VerificationBadge } from "../../sites/components/StatusBadge";
import { Card, CardTitle, CopyButton, Skeleton, PageHeader } from "../../../shared/ui/kit";
import { cmsOrigin, connectorSnippet, isLocalCmsOrigin, proxyDemoUrl } from "../snippet";

export default function SetupPage() {
  const { id } = useParams();
  const siteId = Number(id);
  const { data: site, isLoading } = useSite(Number.isFinite(siteId) ? siteId : null);
  const { data: mappings } = useMappings(Number.isFinite(siteId) ? siteId : null);
  const origin = cmsOrigin(site?.connector_origin);
  const localOnly = isLocalCmsOrigin(origin);

  if (isLoading) return <Skeleton className="h-48" />;
  if (!site) {
    return (
      <Card>
        <p className="text-sm text-red-600">Site not found.</p>
        <Link to="/websites" className="text-sm underline">Back to Websites</Link>
      </Card>
    );
  }

  const snippet = connectorSnippet(origin, site.site_key);
  const isProxy = site.integration_mode === "proxy";

  return (
    <div className="space-y-4">
      <div>
        <Link to="/websites" className="text-sm text-slate-500 underline">← Websites</Link>
        <PageHeader title="Bring your website together" eyebrow="Integration setup" description={site.domain} />
        <div className="mt-2 flex gap-2">
          <VerificationBadge status={site.verification_status} />
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-700">
            {isProxy ? "Reverse proxy" : "Connector script"}
          </span>
        </div>
      </div>

      {localOnly ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><p className="font-semibold">Local testing only — this CMS is not publicly hosted</p><p className="mt-1">The connector currently uses <code>{origin}</code>. That address points to each visitor's own computer, not your CMS. Publish works locally, but does not upload anything to {site.domain}. For public delivery, deploy the CMS over HTTPS and set <code>CMS_PUBLIC_URL</code> to that origin before installing the updated script.</p><p className="mt-2">For tests on this computer, keep the CMS running and check the website's browser console for local-network access restrictions.</p></div> : !origin.startsWith("https:") && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">This CMS address is not HTTPS. An HTTPS website may block the connector. Configure a public HTTPS CMS origin before production use.</p>}

      {site.verification_status !== "verified" && (
        <p role="alert" className="rounded bg-amber-50 p-3 text-sm text-amber-800">
          Verify ownership first — the connector serves full config (including custom code) only to
          verified sites. <Link to={`/websites/${site.id}/verify`} className="underline">Open verification</Link>
        </p>
      )}

      {!isProxy && (
        <Card>
          <CardTitle>Mode A — Connector script (recommended)</CardTitle>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>Paste this tag on <strong>{site.domain}</strong>, just before <code>&lt;/body&gt;</code>.</li>
            <li>Publish the site from the <Link to={`/websites/${site.id}/edit`} className="underline">editor</Link> — changes apply on next page load.</li>
            <li>Fine-tune which element each value overrides on the <Link to={`/websites/${site.id}/mappings`} className="underline">mappings page</Link> ({mappings?.length ?? "…"} active).</li>
          </ol>
          <div className="mt-3 flex flex-wrap items-start gap-2">
            <pre className="min-w-0 flex-1 overflow-x-auto rounded bg-slate-100 p-2 font-mono text-xs dark:bg-slate-700">{snippet}</pre>
            <CopyButton text={snippet} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            The loader reads its own <code>?site=</code> parameter, fetches the published config with ETag
            revalidation, and overrides header, logo, favicon, hero, footer and theme colors in place.
          </p>
          <p className="mt-3 text-xs text-slate-500">Check the <a href={`${origin}/connector/v1/config/${encodeURIComponent(site.site_key)}/`} target="_blank" rel="noreferrer" className="underline">published configuration</a> to confirm the saved values. Uploading an image is separate from choosing it in Logo &amp; Favicon.</p>
        </Card>
      )}

      {isProxy && (
        <Card>
          <CardTitle>Mode B — Reverse proxy</CardTitle>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            <li>Point <strong>{site.domain}</strong>’s DNS (A/CNAME) at this CMS proxy host.</li>
            <li>The proxy fetches the origin, fixes relative URLs with <code>&lt;base&gt;</code>, and injects the connector loader.</li>
            <li>Try the injection pipeline now: <a href={proxyDemoUrl(origin, site.site_key)} target="_blank" rel="noreferrer" className="underline">open proxied homepage</a></li>
          </ol>
          <div className="mt-3">
            <p className="text-sm font-semibold">Limitations (read before cutting over DNS)</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
              <li>Login sessions and cookies set by the origin may not survive proxying (SameSite/domain).</li>
              <li>POST forms, uploads and payment flows should be tested end to end through the proxy.</li>
              <li>TLS terminates at the CMS proxy; the origin should still be HTTPS behind it.</li>
              <li>Heavily JS-driven pages that hardcode absolute URLs can break — verify key journeys.</li>
              <li>Cached origin pages may delay injected changes; purge the origin cache after publishing.</li>
            </ul>
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Check what the connector applied</CardTitle>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Open your connected website's browser console and inspect <code>window.__CMS_CONNECTOR__</code>. It reports the published version, applied fields, missing selectors, and errors. A missing selector means the website needs a matching element or a corrected mapping.</p>
        <p className="mt-3 text-xs leading-6 text-[var(--muted)]">Complex sections use stable hooks such as <code>data-cms="navigation"</code>, <code>data-cms="footer-columns"</code>, and <code>data-cms="newsletter"</code>. Newsletter settings toggle an existing form; the connector does not provide a subscription service. Metadata is applied in the browser; crawler/share previews may require server-side integration.</p>
      </Card>

      <Card>
        <CardTitle>How updates flow</CardTitle>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Saving a draft does nothing public. <strong>Publish</strong> archives the previous version, marks the new
          one live, and purges the connector cache — visitors see the change on their next page load
          (config responses revalidate with ETag every load). <strong>Rollback</strong> works the same way.
        </p>
      </Card>
    </div>
  );
}
