import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { useDiscoverSite, useVerifySite } from "../connect";
import { useSite } from "../api";
import { useEditorConfig } from "../../editor/api";
import { api } from "../../../shared/api/client";
import type { ProgressEvent } from "../hooks";
import { useSiteProgress } from "../hooks";
import { StatusBadge, VerificationBadge } from "../components/StatusBadge";
import { Card, CardTitle, CopyButton, Skeleton } from "../../../shared/ui/kit";

export default function VerifyPage() {
  const { id } = useParams();
  const siteId = Number(id);
  const { data: site, isLoading, isError, refetch } = useSite(Number.isFinite(siteId) ? siteId : null);
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const discover = useDiscoverSite();
  const verify = useVerifySite();
  const { data: editorConfig } = useEditorConfig(Number.isFinite(siteId) ? siteId : null);
  const { data: connectorChecks } = useQuery({
    queryKey: ["verify-connector", siteId],
    queryFn: () =>
      api
        .get<{ results: { detail: Record<string, unknown> }[] }>(
          `/v1/monitoring/checks/?site=${siteId}&check_type=connector&page_size=1`,
        )
        .then((r) => r.data.results),
    enabled: Number.isFinite(siteId),
  });

  useSiteProgress(Number.isFinite(siteId) ? siteId : null, (e) => {
    setEvents((prev) => [...prev.slice(-19), e]);
    if (["completed", "failed", "verified", "verification_failed"].includes(e.stage)) {
      void refetch();
      if (e.stage === "verified") setBanner("Ownership verified.");
      if (e.stage === "verification_failed") setBanner(`Verification failed: ${e.detail ?? "see details below"}`);
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (isError || !site) {
    return (
      <Card>
        <p className="text-sm text-red-600">Site not found.</p>
        <Link to="/websites" className="mt-2 inline-block underline text-sm">Back to Websites</Link>
      </Card>
    );
  }

  const metaSnippet = `<meta name="cms-verify" content="${site.verification_token}" />`;
  const dnsValue = `cms-verify=${site.verification_token}`;
  const snap = (site.discovery ?? {}) as Record<string, string | number>;
  const isVerified = site.verification_status === "verified";
  const loaderPresent = (connectorChecks ?? []).some((c) => c.detail?.present === true);
  const hasPublished = (editorConfig?.published_version_no ?? 0) > 0;
  const steps = [
    {
      label: "Prove ownership",
      hint: isVerified ? `Verified via ${site.verification_method || "unknown method"}.` : "Meta tag or DNS record — identity only, changes nothing on the site.",
      done: isVerified,
      to: "",
      cta: "",
    },
    {
      label: "Install the loader",
      hint: loaderPresent
        ? "Loader detected on the homepage."
        : site.integration_mode === "proxy"
          ? "Point the proxy at us — we inject the loader automatically."
          : "Paste the snippet so published content can appear on the site.",
      done: loaderPresent,
      to: `/websites/${site.id}/setup`,
      cta: "Setup guide",
    },
    {
      label: "Publish content",
      hint: hasPublished ? `Live at version ${editorConfig?.published_version_no}.` : "Edit header, logo and hero, then publish — nothing is live until then.",
      done: hasPublished,
      to: `/websites/${site.id}/edit`,
      cta: "Open editor",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Link to="/websites" className="text-sm text-slate-500 underline">← Websites</Link>
        <h1 className="mt-1 text-2xl font-bold">Connect {site.domain}</h1>
        <div className="mt-2 flex gap-2">
          <StatusBadge status={site.status} />
          <VerificationBadge status={site.verification_status} />
        </div>
      </div>

      {banner && (
        <p role="status" className="rounded bg-slate-100 p-2 text-sm dark:bg-slate-700">
          {banner} <button onClick={() => setBanner(null)} className="underline">Dismiss</button>
        </p>
      )}

      <Card>
        <CardTitle>Getting this site live</CardTitle>
        <ul className="mt-2 space-y-2">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-center gap-3">
              {s.done ? (
                <CheckCircle2 size={20} className="shrink-0 text-green-500" />
              ) : (
                <Circle size={20} className="shrink-0 text-slate-300 dark:text-slate-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{i + 1} · {s.label}</p>
                <p className="truncate text-xs text-slate-500">{s.hint}</p>
              </div>
              {!s.done && s.to && (
                <Link to={s.to} className="shrink-0 rounded border px-2 py-1 text-xs dark:border-slate-600">
                  {s.cta}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>1 · Auto-discovery</CardTitle>
          <button
            onClick={() => discover.mutate(site.id)}
            disabled={discover.isPending}
            className="rounded border px-3 py-1.5 text-sm dark:border-slate-600 disabled:opacity-50"
          >
            {discover.isPending ? "Starting…" : "Re-run discovery"}
          </button>
        </div>
        <p className="mt-2 text-sm">
          Status: <strong className="capitalize">{site.discovery_status}</strong>
          {site.discovered_at && <span> · {new Date(site.discovered_at).toLocaleString()}</span>}
        </p>
        {site.discovery_error && <p className="mt-1 text-sm text-red-600">{site.discovery_error}</p>}
        {site.discovery_status === "succeeded" && (
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Title</dt><dd className="font-medium">{String(snap.title || "—")}</dd></div>
            <div><dt className="text-slate-500">Final URL</dt><dd className="break-all font-mono text-xs">{String(snap.final_url || "—")}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-500">Description</dt><dd>{String(snap.description || "—")}</dd></div>
            <div>
              <dt className="text-slate-500">Favicon</dt>
              <dd>{snap.favicon_url ? <img src={String(snap.favicon_url)} alt="favicon" className="h-6 w-6" /> : "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Logo</dt>
              <dd>{snap.logo_url ? <img src={String(snap.logo_url)} alt="logo" className="h-8" /> : "—"}</dd>
            </div>
            {snap.theme_color ? (
              <div>
                <dt className="text-slate-500">Theme color</dt>
                <dd className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 rounded border" style={{ background: String(snap.theme_color) }} />
                  {String(snap.theme_color)}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
      </Card>

      <Card>
        <CardTitle>2 · Prove ownership</CardTitle>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          The site stays <strong>Pending</strong> until you prove you own <strong>{site.domain}</strong> with one of
          these methods.
        </p>

        <div className="mt-3 rounded border p-3 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Option A — HTML meta tag</p>
            <CopyButton text={metaSnippet} />
          </div>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 font-mono text-xs dark:bg-slate-700">{metaSnippet}</pre>
          <ol className="mt-2 list-decimal pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>Paste the tag inside the <code>&lt;head&gt;</code> of {site.domain}’s homepage.</li>
            <li>Click Verify below. We fetch the page and compare the token.</li>
          </ol>
          <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            Note: the tag only proves ownership — it cannot change anything on your site.
            To publish CMS content you still need the loader snippet (step 2 above).
          </p>
          <button
            onClick={() => verify.mutate({ id: site.id, method: "meta" })}
            disabled={verify.isPending}
            className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            Verify meta tag
          </button>
        </div>

        <div className="mt-3 rounded border p-3 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Option B — DNS TXT record</p>
            <CopyButton text={dnsValue} />
          </div>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 font-mono text-xs dark:bg-slate-700">{`Type: TXT\nHost: @\nValue: ${dnsValue}`}</pre>
          <ol className="mt-2 list-decimal pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>Add the TXT record at your DNS provider (apex of {site.domain}).</li>
            <li>Wait for DNS propagation, then click Verify.</li>
          </ol>
          <button
            onClick={() => verify.mutate({ id: site.id, method: "dns" })}
            disabled={verify.isPending}
            className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            Verify DNS record
          </button>
        </div>

        {site.verification_error && <p className="mt-2 text-sm text-red-600">{site.verification_error}</p>}
        {site.verification_status === "verified" && site.verified_at && (
          <p className="mt-2 text-sm text-green-700">
            Verified via {site.verification_method || "unknown method"} on {new Date(site.verified_at).toLocaleString()}.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>3 · Next steps</CardTitle>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Site verified? Open the <Link to={`/websites/${site.id}/edit`} className="underline">site editor</Link> to
          change the header, logo, hero and more, then publish. Integration mode
          selected: <strong>{site.integration_mode === "proxy" ? "Reverse proxy" : "Connector script"}</strong>.
        </p>
      </Card>

      {events.length > 0 && (
        <Card>
          <CardTitle>Live progress</CardTitle>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {events.map((e, i) => (
              <li key={i}>
                {e.stage}
                {e.method ? ` (${e.method})` : ""}
                {e.detail ? ` — ${e.detail}` : ""}
                {e.error ? ` — ${e.error}` : ""}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
