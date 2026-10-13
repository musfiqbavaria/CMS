import { useEffect } from "react";
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

export default function SiteFormModal({ open, site, busy, serverError, onClose, onSubmit }: Props) {
  const form = useForm<SiteSchemaValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: "", domain: "", type: "connected", integration_mode: "connector" },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        site
          ? { name: site.name, domain: site.domain, type: site.type, integration_mode: site.integration_mode }
          : { name: "", domain: "", type: "connected", integration_mode: "connector" },
      );
    }
  }, [open, site, form]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 className="text-lg font-bold">{site ? "Edit website" : "Add website"}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {site ? "Update the site details." : "Register a site by domain. Ownership verification arrives in Phase 4."}
        </p>
        {serverError && (
          <p role="alert" className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">
            {serverError}
          </p>
        )}
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium" htmlFor="site-name">Name</label>
            <input id="site-name" className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="site-domain">Domain</label>
            <input id="site-domain" placeholder="example.com" className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" {...form.register("domain")} />
            {form.formState.errors.domain && <p className="text-xs text-red-600">{form.formState.errors.domain.message}</p>}
          </div>
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
