import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSite } from "../../sites/api";
import { useMappings } from "../api";
import { VerificationBadge } from "../../sites/components/StatusBadge";
import { Card, CardTitle, Skeleton } from "../../../shared/ui/kit";
import { cmsOrigin, connectorSnippet, proxyDemoUrl } from "../snippet";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="rounded border px-2 py-1 text-xs dark:border-slate-600"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function SetupPage() {
  const { id } = useParams();
  const siteId = Number(id);
  const { data: site, isLoading } = useSite(Number.isFinite(siteId) ? siteId : null);
  const { data: mappings } = useMappings(Number.isFinite(siteId) ? siteId : null);
  const origin = cmsOrigin();

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
        <h1 className="mt-1 text-2xl font-bold">Setup — {site.domain}</h1>
        <div className="mt-2 flex gap-2">
          <VerificationBadge status={site.verification_status} />
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium dark:bg-slate-700">
            {isProxy ? "Reverse proxy" : "Connector script"}
          </span>
        </div>
      </div>

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
          <div className="mt-3 flex items-start gap-2">
            <pre className="flex-1 overflow-x-auto rounded bg-slate-100 p-2 font-mono text-xs dark:bg-slate-700">{snippet}</pre>
            <CopyButton text={snippet} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            The loader reads its own <code>?site=</code> parameter, fetches the published config with ETag
            revalidation, and overrides header, logo, favicon, hero, footer and theme colors in place.
          </p>
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
