import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { siteSchema, type SiteSchemaValues } from "../schemas";
import type { Site } from "../types";

interface Props {
  open: boolean;
  site: Site | null;
  busy: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (values: SiteSchemaValues) => void;
}

const PLATFORM_BASE = ((import.meta.env.VITE_PLATFORM_BASE_DOMAIN as string | undefined) ?? "")
  .trim()
  .toLowerCase()
  .replace(/\.$/, "");

type AddressMode = "subdomain" | "custom";

function managedLabel(domain: string): string {
  const host = domain.trim().toLowerCase();
  if (PLATFORM_BASE && host !== PLATFORM_BASE && host.endsWith(`.${PLATFORM_BASE}`)) {
    return host.slice(0, -(PLATFORM_BASE.length + 1));
  }
  return host.split(".")[0] ?? "";
}

export default function SiteFormModal({ open, site, busy, serverError, onClose, onSubmit }: Props) {
  const form = useForm<SiteSchemaValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: "", domain: "", subdomain: "", type: "connected", integration_mode: "connector" },
  });
  const [mode, setMode] = useState<AddressMode>("custom");

  const watchedType = form.watch("type");
  const watchedSubdomain = form.watch("subdomain");
  const subdomainsEnabled = PLATFORM_BASE.length > 0;
  const showAddressChoice = watchedType === "built";
  const useSubdomain = showAddressChoice && subdomainsEnabled && mode === "subdomain";

  useEffect(() => {
    if (open) {
      if (site) {
        const managed = site.is_managed;
        setMode(managed ? "subdomain" : "custom");
        form.reset({
          name: site.name,
          domain: managed ? "" : site.domain,
          subdomain: managed ? managedLabel(site.domain) : "",
          type: site.type,
          integration_mode: site.integration_mode,
        });
      } else {
        setMode("custom");
        form.reset({ name: "", domain: "", subdomain: "", type: "connected", integration_mode: "connector" });
      }
    }
  }, [open, site, form]);

  if (!open) return null;

  function submit(values: SiteSchemaValues) {
    if (values.type === "built" && useSubdomain) {
      onSubmit({ ...values, domain: "", subdomain: (values.subdomain ?? "").trim().toLowerCase() });
    } else {
      onSubmit({ ...values, subdomain: "", domain: (values.domain ?? "").trim() });
    }
  }

  const previewHost = useSubdomain
    ? `${(watchedSubdomain ?? "").trim().toLowerCase() || "your-name"}.${PLATFORM_BASE}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 className="text-lg font-bold">{site ? "Edit website" : "Add website"}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {site
            ? "Update the site details."
            : watchedType === "built"
              ? "Built sites are hosted here: pick a free subdomain or point a custom domain at us."
              : "Connect an existing external site by domain. We will discover it and verify ownership."}
        </p>
        {serverError && (
          <p role="alert" className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">
            {serverError}
          </p>
        )}
        <form onSubmit={form.handleSubmit(submit)} className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium" htmlFor="site-name">Name</label>
            <input id="site-name" className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>}
          </div>
          {showAddressChoice && subdomainsEnabled && (
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setMode("subdomain")}
                aria-pressed={mode === "subdomain"}
                className={`flex-1 rounded border px-3 py-2 ${mode === "subdomain" ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "dark:border-slate-600"}`}
              >
                Free subdomain
              </button>
              <button
                type="button"
                onClick={() => setMode("custom")}
                aria-pressed={mode === "custom"}
                className={`flex-1 rounded border px-3 py-2 ${mode === "custom" ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900" : "dark:border-slate-600"}`}
              >
                Custom domain
              </button>
            </div>
          )}
          {useSubdomain ? (
            <div>
              <label className="text-sm font-medium" htmlFor="site-subdomain">Subdomain</label>
              <div className="mt-1 flex items-center gap-1">
                <input
                  id="site-subdomain"
                  placeholder="myshop"
                  className="w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700"
                  {...form.register("subdomain")}
                />
                <span className="whitespace-nowrap text-sm text-slate-500">.{PLATFORM_BASE}</span>
              </div>
              {form.formState.errors.subdomain && <p className="text-xs text-red-600">{form.formState.errors.subdomain.message}</p>}
              <p className="mt-1 text-xs text-slate-500">
                Your site will live at <span className="font-mono">https://{previewHost}</span> on this platform.
              </p>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium" htmlFor="site-domain">Domain</label>
              <input id="site-domain" placeholder="example.com" className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" {...form.register("domain")} />
              {form.formState.errors.domain && <p className="text-xs text-red-600">{form.formState.errors.domain.message}</p>}
              {showAddressChoice && !subdomainsEnabled && (
                <p className="mt-1 text-xs text-slate-500">
                  Free subdomains are disabled (no platform base domain configured). Point your domain&apos;s DNS at this server.
                </p>
              )}
              {showAddressChoice && subdomainsEnabled && (
                <p className="mt-1 text-xs text-slate-500">
                  Point your domain&apos;s DNS at this server. DNS verification for custom domains arrives in Phase 11.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium" htmlFor="site-type">Type</label>
              <select id="site-type" className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" {...form.register("type")}>
                <option value="connected">Connected</option>
                <option value="built">Built</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="site-mode">Integration</label>
              <select id="site-mode" className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" {...form.register("integration_mode")}>
                <option value="connector">Connector script</option>
                <option value="proxy">Reverse proxy</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm dark:border-slate-600">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy ? "Saving…" : site ? "Save changes" : "Add website"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
