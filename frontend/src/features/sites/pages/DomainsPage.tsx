import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSite } from "../api";
import { useAddDomain, useCheckDomain, useDeleteDomain, useMakePrimary, useSiteDomains } from "../domains";
import type { SiteDomain } from "../types";
import { publicSiteUrl } from "../links";
import { Card, CardTitle, CopyButton, Skeleton, PageHeader } from "../../../shared/ui/kit";

function serverMessage(err: unknown): string {
  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (data && typeof data === "object") {
    const first = Object.values(data as Record<string, unknown>)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return "Request failed. Try again.";
}

function DnsHelp({ domain }: { domain: SiteDomain }) {
  if (!domain.dns) return null;
  return (
    <div className="mt-2 rounded bg-slate-50 p-3 text-xs dark:bg-slate-700">
      <p className="font-medium">Point this domain at the platform, then prove ownership:</p>
      <ol className="mt-1 list-decimal space-y-2 pl-4">
        <li>
          Add a <span className="font-mono">CNAME</span> record:
          <span className="ml-1 font-mono">{domain.dns.cname_host}</span> →{" "}
          <span className="font-mono">{domain.dns.cname_target || "(set PLATFORM_INGRESS_HOST)"}</span>{" "}
          <CopyButton text={domain.dns.cname_target} />
        </li>
        <li>
          Add a <span className="font-mono">TXT</span> record on{" "}
          <span className="font-mono">{domain.dns.txt_host}</span> with value{" "}
          <span className="font-mono">{domain.dns.txt_value}</span>{" "}
          <CopyButton text={domain.dns.txt_value} />
        </li>
        <li>Wait for DNS to propagate, then press “Check verification”.</li>
      </ol>
    </div>
  );
}

export default function DomainsPage() {
  const { id } = useParams();
  const siteId = Number(id);
  const valid = Number.isFinite(siteId);
  const { data: site } = useSite(valid ? siteId : null);
  const { data: domains, isLoading, isError } = useSiteDomains(valid ? siteId : null);
  const [hostname, setHostname] = useState("");
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const add = useAddDomain(siteId);
  const check = useCheckDomain(siteId);
  const makePrimary = useMakePrimary(siteId);
  const remove = useDeleteDomain(siteId);

  function onMutate<V>(
    mutate: (value: V, opts: { onSuccess: () => void; onError: (e: unknown) => void }) => void,
    value: V,
    ok: string,
    clearInput = false,
  ) {
    setBanner(null);
    mutate(value, {
      onSuccess: () => {
        setBanner({ kind: "ok", text: ok });
        if (clearInput) setHostname("");
      },
      onError: (e: unknown) => setBanner({ kind: "err", text: serverMessage(e) }),
    });
  }

  if (!valid) {
    return (
      <Card>
        <p className="text-sm text-red-600">Invalid site.</p>
        <Link to="/websites" className="mt-2 inline-block text-sm underline">Back to Websites</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/websites" className="text-sm text-slate-500 underline">← Websites</Link>
        <PageHeader title={site ? `Domains · ${site.name}` : "Domains"} eyebrow="Your address online" />
        <p className="mt-1 text-sm text-slate-500">
          Every address below serves this site from our platform. Custom domains go live after DNS verification.
        </p>
      </div>

      {banner && (
        <p role={banner.kind === "ok" ? "status" : "alert"} className={`rounded p-2 text-sm ${banner.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {banner.text} <button onClick={() => setBanner(null)} className="ml-2 underline">Dismiss</button>
        </p>
      )}

      <Card>
        <CardTitle>Add a custom domain</CardTitle>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (hostname.trim()) onMutate(add.mutate, hostname.trim(), `Added ${hostname.trim()}.`, true);
          }}
        >
          <input
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="acme-store.com"
            className="min-w-48 flex-1 rounded border p-2 text-sm dark:border-slate-600 dark:bg-slate-700"
          />
          <button
            type="submit"
            disabled={add.isPending || !hostname.trim()}
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {add.isPending ? "Adding…" : "Add domain"}
          </button>
        </form>
        {add.isError && <p role="alert" className="mt-2 text-sm text-red-600">{serverMessage(add.error)}</p>}
      </Card>

      <Card>
        <CardTitle>Addresses</CardTitle>
        {isLoading ? (
          <div className="mt-2 space-y-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : isError ? (
          <p className="mt-2 text-sm text-red-600">Could not load domains.</p>
        ) : (domains ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No addresses yet.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {(domains ?? []).map((d) => (
              <li key={d.id} className="rounded border p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <a href={publicSiteUrl(d.hostname)} target="_blank" rel="noopener noreferrer" className="font-mono font-medium hover:underline">
                    {d.hostname}
                  </a>
                  {d.is_primary && <span className="rounded bg-slate-900 px-1.5 py-0.5 text-xs text-white">primary</span>}
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs capitalize dark:bg-slate-700">{d.kind}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs capitalize ${d.verification_status === "verified" ? "bg-green-100 text-green-700" : d.verification_status === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                    {d.verification_status}
                  </span>
                  <span className="ml-auto inline-flex gap-1">
                    {d.verification_status !== "verified" && (
                      <button onClick={() => onMutate(check.mutate, d.id, "Verification checked.")} disabled={check.isPending} className="rounded border px-2 py-1 text-xs dark:border-slate-600 disabled:opacity-50">
                        Check verification
                      </button>
                    )}
                    {!d.is_primary && d.verification_status === "verified" && (
                      <button onClick={() => onMutate(makePrimary.mutate, d.id, `${d.hostname} is now primary.`)} disabled={makePrimary.isPending} className="rounded border px-2 py-1 text-xs dark:border-slate-600 disabled:opacity-50">
                        Make primary
                      </button>
                    )}
                    {!d.is_primary && (
                      <button onClick={() => { if (window.confirm(`Remove ${d.hostname}?`)) onMutate(remove.mutate, d.id, `Removed ${d.hostname}.`); }} disabled={remove.isPending} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 disabled:opacity-50">
                        Delete
                      </button>
                    )}
                  </span>
                </div>
                {d.verification_error && <p className="mt-1 text-xs text-red-600">{d.verification_error}</p>}
                {d.verification_status !== "verified" && <DnsHelp domain={d} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
