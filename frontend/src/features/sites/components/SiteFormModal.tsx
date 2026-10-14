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
  /** Create forms: "both" (chooser), "hosted" (build flow) or "connected" (Websites flow). */
  createMode?: "both" | "hosted" | "connected";
}

const PLATFORM_BASE = ((import.meta.env.VITE_PLATFORM_BASE_DOMAIN as string | undefined) ?? "")
  .trim()
  .toLowerCase()
  .replace(/\.$/, "");

type CreatePath = "hosted" | "connected";

function managedLabel(domain: string): string {
  const host = domain.trim().toLowerCase();
  if (PLATFORM_BASE && host !== PLATFORM_BASE && host.endsWith(`.${PLATFORM_BASE}`)) {
    return host.slice(0, -(PLATFORM_BASE.length + 1));
  }
  return host.split(".")[0] ?? "";
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export default function SiteFormModal({ open, site, busy, serverError, onClose, onSubmit, createMode = "both" }: Props) {
  const form = useForm<SiteSchemaValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: "", domain: "", subdomain: "", type: "built", integration_mode: "connector" },
  });
  const [path, setPath] = useState<CreatePath>("hosted");
  const [autoSub, setAutoSub] = useState(true);

  const watchedName = form.watch("name");
  const watchedSubdomain = form.watch("subdomain");
  const watchedDomain = form.watch("domain");
  const subdomainsEnabled = PLATFORM_BASE.length > 0;

  useEffect(() => {
    if (open) {
      setAutoSub(true);
      if (site) {
        const managed = site.is_managed;
        setPath(site.type === "built" ? "hosted" : "connected");
        form.reset({
          name: site.name,
          domain: managed ? "" : site.domain,
          subdomain: managed ? managedLabel(site.domain) : "",
          type: site.type,
          integration_mode: site.integration_mode,
        });
      } else {
        setPath(createMode === "connected" ? "connected" : "hosted");
        form.reset({ name: "", domain: "", subdomain: "", type: "built", integration_mode: "connector" });
      }
    }
  }, [open, site, form]);

  useEffect(() => {
    if (open && !site) {
      form.setValue("type", path === "hosted" ? "built" : "connected", { shouldValidate: true });
    }
  }, [open, site, path, form]);

  // Auto-generate the subdomain from the site name until the user edits it.
  useEffect(() => {
    if (open && !site && autoSub && subdomainsEnabled) {
      form.setValue("subdomain", slugify(watchedName ?? ""), { shouldValidate: true });
    }
  }, [open, site, autoSub, subdomainsEnabled, watchedName, form]);

  if (!open) return null;

  const editing = site !== null;
  const customDomain = (watchedDomain ?? "").trim();

  function submit(values: SiteSchemaValues) {
    if (!editing && path === "hosted") {
      if (customDomain) {
        onSubmit({ ...values, type: "built", subdomain: "", domain: customDomain });
      } else {
        // Blank subdomain is fine: the server allocates one from the name
        // against this environment's base domain.
        onSubmit({ ...values, type: "built", domain: "", subdomain: (values.subdomain ?? "").trim().toLowerCase() });
      }
      return;
    }
    if (!editing && path === "connected") {
      onSubmit({ ...values, type: "connected", subdomain: "", domain: (values.domain ?? "").trim() });
      return;
    }
    // Edit: only send address fields the user actually filled in.
    const patch: SiteSchemaValues = { ...values };
    if (!(values.domain ?? "").trim()) delete (patch as Record<string, unknown>).domain;
    if (!(values.subdomain ?? "").trim()) delete (patch as Record<string, unknown>).subdomain;
    onSubmit(patch);
  }

  const previewHost = customDomain || (
    subdomainsEnabled
      ? `${(watchedSubdomain ?? "").trim().toLowerCase() || "your-name"}.${PLATFORM_BASE}`
      : null
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 className="text-lg font-bold">{editing ? "Edit website" : createMode === "hosted" ? "Build a new website" : "Add website"}</h2>
        {!editing && createMode === "both" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPath("hosted")}
              aria-pressed={path === "hosted"}
              className={`rounded-lg border p-3 text-left ${path === "hosted" ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-700" : "dark:border-slate-600"}`}
            >
              <span className="block text-sm font-bold">🌐 New hosted site</span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Build a Google-Sites-style website hosted here</span>
            </button>
            <button
              type="button"
              onClick={() => setPath("connected")}
              aria-pressed={path === "connected"}
              className={`rounded-lg border p-3 text-left ${path === "connected" ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-700" : "dark:border-slate-600"}`}
            >
              <span className="block text-sm font-bold">🔗 Connect existing site</span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Manage a site that lives elsewhere</span>
            </button>
          </div>
        )}
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {editing
            ? "Update the site details."
            : path === "hosted"
              ? "Pick a name and address — then add pages from a template."
              : "We will discover its content and verify ownership."}
        </p>
        {serverError && (
          <p role="alert" className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">
            {serverError}
          </p>
        )}
        <form onSubmit={form.handleSubmit(submit)} className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium" htmlFor="site-name">Name</label>
            <input id="site-name" placeholder={path === "hosted" && !editing ? "My Awesome Site" : undefined} className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>}
          </div>

          {(editing || path === "connected") && !(editing && site?.type === "built") && (
            <div>
              <label className="text-sm font-medium" htmlFor="site-domain">Domain</label>
              <input id="site-domain" placeholder="example.com" className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" {...form.register("domain")} />
              {form.formState.errors.domain && <p className="text-xs text-red-600">{form.formState.errors.domain.message}</p>}
              {!editing && (
                <p className="mt-1 text-xs text-slate-500">Keep the site online — we fetch its homepage for discovery.</p>
              )}
            </div>
          )}

          {(!editing && path === "hosted") || (editing && site?.type === "built") ? (
            <div className="space-y-3">
              {subdomainsEnabled ? (
                <div>
                  <label className="text-sm font-medium" htmlFor="site-subdomain">Site address</label>
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      id="site-subdomain"
                      placeholder="mysite"
                      className="w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700"
                      {...form.register("subdomain", { onChange: () => setAutoSub(false) })}
                    />
                    <span className="whitespace-nowrap text-sm text-slate-500">.{PLATFORM_BASE}</span>
                  </div>
                  {form.formState.errors.subdomain && <p className="text-xs text-red-600">{form.formState.errors.subdomain.message}</p>}
                  {previewHost && (
                    <p className="mt-1 text-xs text-slate-500">
                      {autoSub && !editing ? "Auto-generated from the name — edit it or leave it. " : ""}
                      Your site will live at <span className="font-mono">https://{previewHost}</span>.
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                  Free subdomains are disabled here (no platform base domain configured) — enter your own domain below.
                </p>
              )}
              <div>
                <label className="text-sm font-medium" htmlFor="site-domain">
                  Custom domain <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input id="site-domain" placeholder="mysite.com" className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" {...form.register("domain")} />
                {form.formState.errors.domain && <p className="text-xs text-red-600">{form.formState.errors.domain.message}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  Prefer your own domain? Enter it here — it takes precedence. Point its DNS at this server; you can attach more addresses later under Domains.
                </p>
              </div>
            </div>
          ) : null}

          {(editing || path === "connected") && (
            <div>
              <label className="text-sm font-medium" htmlFor="site-mode">Integration</label>
              <select id="site-mode" className="mt-1 w-full rounded border p-2 dark:border-slate-600 dark:bg-slate-700" {...form.register("integration_mode")}>
                <option value="connector">Connector script</option>
                <option value="proxy">Reverse proxy</option>
              </select>
              {!editing && (
                <p className="mt-1 text-xs text-slate-500">Connector edits content in place · Proxy serves through us.</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm dark:border-slate-600">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy ? "Saving…" : editing ? "Save changes" : path === "hosted" ? "Create site" : "Connect site"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
