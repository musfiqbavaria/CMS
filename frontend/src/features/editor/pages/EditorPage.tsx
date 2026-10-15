import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { usePatchDraft, usePublish, useSaveDraft, useEditorConfig } from "../api";
import { ResetDraftButton, UnsavedGuard, VersionsPanel } from "../components/VersionControls";
import { configToHtml, isDirty } from "../preview";
import { EDITOR_TABS, type EditorTabKey, type SiteConfigDraft } from "../types";
import { useSite } from "../../sites/api";
import { BrandingTab, CoverTab, FooterTab, GeneralTab, HeaderTab, SeoTab } from "../tabsA";
import { CustomTab, HeroTab, NavTab, SocialTab, ThemeTab } from "../tabsB";
import { Badge, Card, PageHeader } from "../../../shared/ui/kit";
import { AdvancedTab } from "./AdvancedTab";
import { cmsOrigin, isLocalCmsOrigin } from "../../connector/snippet";

function TabBody({ tab, control, siteId, seededTitle }: { tab: EditorTabKey; control: Parameters<typeof GeneralTab>[0]["control"]; siteId: number; seededTitle?: string }) {
  switch (tab) {
    case "general": return <GeneralTab control={control} seededTitle={seededTitle} />;
    case "header": return <HeaderTab control={control} siteId={siteId} />;
    case "footer": return <FooterTab control={control} />;
    case "branding": return <BrandingTab control={control} siteId={siteId} />;
    case "cover": return <CoverTab control={control} siteId={siteId} />;
    case "hero": return <HeroTab control={control} siteId={siteId} />;
    case "navigation": return <NavTab control={control} />;
    case "theme": return <ThemeTab control={control} />;
    case "seo": return <SeoTab control={control} siteId={siteId} />;
    case "custom": return <CustomTab control={control} />;
    case "social": return <SocialTab control={control} />;
    case "advanced": return <AdvancedTab control={control} siteId={siteId} />;
  }
}

export default function EditorPage() {
  const { id } = useParams();
  const siteId = Number(id);
  const validId = Number.isFinite(siteId) ? siteId : null;
  const { data: site } = useSite(validId);
  const { data: config, isLoading, isError, refetch } = useEditorConfig(validId);

  const [tab, setTab] = useState<EditorTabKey>("general");
  const [view, setView] = useState<"editor" | "preview" | "split">("split");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [operation, setOperation] = useState<"save" | "publish" | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const form = useForm<SiteConfigDraft>();
  const loadedFor = useRef<number | null>(null);
  const activeSite = useRef(siteId);
  activeSite.current = siteId;
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const pendingWrite = useRef<Promise<unknown>>(Promise.resolve());
  const operationRef = useRef(false);
  const patchDraft = usePatchDraft(siteId);
  const saveDraft = useSaveDraft(siteId);
  const publish = usePublish(siteId);
  const busy = operation !== null || saveDraft.isPending || publish.isPending;
  const localOnly = isLocalCmsOrigin(cmsOrigin(site?.connector_origin));

  useEffect(() => {
    if (config && loadedFor.current !== config.id) {
      loadedFor.current = config.id;
      form.reset(config.draft);
    }
  }, [config, form]);

  const values = useWatch({ control: form.control });
  const { isDirty: formDirty } = form.formState;
  const dirty = formDirty && !!config && isDirty(config.draft, values as SiteConfigDraft);

  function writeDraft(snapshot: Partial<SiteConfigDraft>) {
    // Serialize draft writes so an older autosave cannot overtake Publish.
    const request = pendingWrite.current.catch(() => undefined).then(() => {
      if (activeSite.current !== siteId) throw new Error("The editor website changed.");
      return patchDraft.mutateAsync(snapshot);
    });
    pendingWrite.current = request;
    return request;
  }

  // Silent autosave 2s after the last change; manual actions drain this queue.
  useEffect(() => {
    if (!config || loadedFor.current !== config.id || !formDirty || operationRef.current) return;
    autosaveTimer.current = setTimeout(() => {
      if (operationRef.current) return;
      setSaving(true);
      const snapshot = JSON.parse(JSON.stringify(values)) as Partial<SiteConfigDraft>;
      const request = writeDraft(snapshot);
      void request.catch(() => { if (activeSite.current === siteId) setBanner({ kind: "err", text: "Autosave failed. Your edits are still in this form; try Save draft." }); }).finally(() => {
        if (pendingWrite.current === request) setSaving(false);
      });
    }, 2000);
    return () => clearTimeout(autosaveTimer.current);
  }, [values, config?.id, formDirty]);

  // Browser-level unsaved guard.
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  const previewHtml = useMemo(
    () => (values && typeof values === "object" && "hero" in (values as object) ? configToHtml(values as SiteConfigDraft) : ""),
    [values],
  );

  async function flush(): Promise<void> {
    clearTimeout(autosaveTimer.current);
    const snapshot = JSON.parse(JSON.stringify(form.getValues())) as Partial<SiteConfigDraft>;
    const updated = await writeDraft(snapshot);
    if (activeSite.current !== siteId) throw new Error("The editor website changed.");
    setSaving(false);
    form.reset(updated.draft, { keepDirty: false });
  }

  async function onSaveDraft() {
    if (operationRef.current) return;
    operationRef.current = true;
    setOperation("save");
    setBanner(null);
    try {
      await flush();
      const v = await saveDraft.mutateAsync(note);
      if (activeSite.current !== siteId) return;
      setNote("");
      setBanner({ kind: "ok", text: `Draft saved as v${v.version_no}.` });
    } catch {
      if (activeSite.current === siteId) setBanner({ kind: "err", text: "Saving failed. Try again." });
    } finally { operationRef.current = false; setOperation(null); setSaving(false); }
  }

  async function onPublish() {
    if (operationRef.current) return;
    if (!window.confirm("Publish the current draft to the live site?")) return;
    operationRef.current = true;
    setOperation("publish");
    setBanner(null);
    try {
      await flush();
      const v = await publish.mutateAsync(undefined);
      const r = await refetch();
      if (activeSite.current !== siteId) return;
      if (r.data) form.reset(r.data.draft, { keepDirty: false });
      setBanner({ kind: "ok", text: `Published v${v.version_no}. Reload the connected website to fetch this version.${localOnly ? " Your CMS is local, so public visitors cannot receive it yet." : ""}` });
    } catch {
      if (activeSite.current === siteId) setBanner({ kind: "err", text: "Publish failed. Try again." });
    } finally { operationRef.current = false; setOperation(null); setSaving(false); }
  }

  async function reload() {
    const r = await refetch();
    if (r.data && activeSite.current === siteId) {
      loadedFor.current = r.data.id;
      form.reset(r.data.draft, { keepDirty: false });
    }
  }

  if (isLoading) return <p className="text-sm text-slate-500">Loading editor…</p>;
  if (isError || !config || validId === null) {
    return (
      <Card>
        <p className="text-sm text-red-600">Site not found.</p>
        <Link to="/websites" className="text-sm underline">Back to Websites</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Link to="/websites" className="text-sm text-slate-500 underline">← Websites</Link>
        <PageHeader title={site?.name ?? "Site editor"} eyebrow="Make it your own" description={`Edit the details that make ${site?.domain ?? "your website"} feel like you. Publish when you're ready to share.`} actions={<Badge tone={saving || dirty ? "amber" : "green"}>{saving ? "Autosaving..." : dirty ? "Draft changes" : "Draft saved"}</Badge>} />
      </div>

      {localOnly && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Local testing mode. Publish saves changes in this CMS; it does not upload files to {site?.domain}. Public visitors need a publicly reachable HTTPS CMS. <Link to={`/websites/${siteId}/setup`} className="font-semibold underline">Check connector setup</Link>.</p>}

      {banner && (
        <p role={banner.kind === "ok" ? "status" : "alert"} className={`rounded p-2 text-sm ${banner.kind === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {banner.text} <button onClick={() => setBanner(null)} className="underline">Dismiss</button>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <input aria-label="Version note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Version note (optional)" className="w-52 rounded border p-1.5 text-sm dark:border-slate-600 dark:bg-slate-700" />
        <button onClick={onSaveDraft} disabled={busy} className="rounded border px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600">
          {saveDraft.isPending ? "Saving…" : "Save draft"}
        </button>
        <button onClick={onPublish} disabled={busy} className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">
          {publish.isPending ? "Publishing…" : "Publish"}
        </button>
        <fieldset disabled={busy || saving} className="contents"><ResetDraftButton siteId={siteId} onDone={() => void reload()} /></fieldset>
        <span className="ml-auto inline-flex rounded border text-sm dark:border-slate-600">
          {(["editor", "preview", "split"] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={`px-2 py-1 capitalize ${view === v ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : ""}`}>
              {v}
            </button>
          ))}
        </span>
      </div>

      <div className={`grid gap-4 ${view === "split" ? "xl:grid-cols-2" : ""}`}>
        {view !== "preview" && (
          <div className="min-w-0 space-y-3">
            <div aria-label="Editor sections" className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
              {EDITOR_TABS.map((t) => (
                <button
                  key={t.key}
                  aria-pressed={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={`whitespace-nowrap rounded px-2.5 py-1.5 text-sm ${tab === t.key ? "bg-slate-900 font-medium text-white dark:bg-white dark:text-slate-900" : "border dark:border-slate-600"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <fieldset disabled={busy} className="contents">
              <Card>
                <TabBody tab={tab} control={form.control} siteId={siteId} seededTitle={String(site?.discovery?.title || site?.name || "")} />
              </Card>
              <fieldset disabled={saving} className="contents"><VersionsPanel siteId={siteId} onRestored={() => void reload()} /></fieldset>
            </fieldset>
          </div>
        )}
        {view !== "editor" && (
          <Card className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-hidden">
            <p className="mb-2 text-sm font-semibold text-slate-500">Draft preview</p>
            <p className="mb-3 text-xs leading-5 text-[var(--muted)]">This template illustrates your settings. Your connected website keeps its own HTML and uses the configured selector mappings.</p>
            <iframe title="Draft preview" srcDoc={previewHtml} sandbox="allow-scripts" className="h-[70vh] w-full rounded border bg-white dark:border-slate-600" />
          </Card>
        )}
      </div>

      <UnsavedGuard when={dirty} />
    </div>
  );
}
