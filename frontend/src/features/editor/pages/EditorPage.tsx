import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
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

function TabBody({ tab, control, siteId }: { tab: EditorTabKey; control: Parameters<typeof GeneralTab>[0]["control"]; siteId: number }) {
  switch (tab) {
    case "general": return <GeneralTab control={control} />;
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
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const form = useForm<SiteConfigDraft>();
  const loadedFor = useRef<number | null>(null);
  const patchDraft = usePatchDraft(siteId);
  const saveDraft = useSaveDraft(siteId);
  const publish = usePublish(siteId);
  const busy = saveDraft.isPending || publish.isPending;

  useEffect(() => {
    if (config && loadedFor.current !== config.id) {
      loadedFor.current = config.id;
      form.reset(config.draft);
    }
  }, [config, form]);

  const values = form.watch();
  const { isDirty: formDirty } = form.formState;
  const dirty = formDirty && !!config && isDirty(config.draft, values as SiteConfigDraft);

  // Silent autosave 2s after the last change.
  useEffect(() => {
    if (!config || loadedFor.current !== config.id || !formDirty) return;
    const t = setTimeout(() => {
      setSaving(true);
      patchDraft.mutate(values as Partial<SiteConfigDraft>, { onSettled: () => setSaving(false) });
    }, 2000);
    return () => clearTimeout(t);
  }, [values, config?.id]);

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
    await patchDraft.mutateAsync(form.getValues() as Partial<SiteConfigDraft>);
    const r = await refetch();
    if (r.data) form.reset(r.data.draft, { keepDirty: false });
  }

  async function onSaveDraft() {
    setBanner(null);
    try {
      await flush();
      const v = await saveDraft.mutateAsync(note);
      setNote("");
      setBanner({ kind: "ok", text: `Draft saved as v${v.version_no}.` });
    } catch {
      setBanner({ kind: "err", text: "Saving failed. Try again." });
    }
  }

  async function onPublish() {
    if (!window.confirm("Publish the current draft to the live site?")) return;
    setBanner(null);
    try {
      await flush();
      const v = await publish.mutateAsync(undefined);
      const r = await refetch();
      if (r.data) form.reset(r.data.draft, { keepDirty: false });
      setBanner({ kind: "ok", text: `Published v${v.version_no}.` });
    } catch {
      setBanner({ kind: "err", text: "Publish failed. Try again." });
    }
  }

  async function reload() {
    const r = await refetch();
    if (r.data) {
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
        <PageHeader title={site?.name ?? "Site editor"} eyebrow="Make it your own" description={`Edit the details that make ${site?.domain ?? "your website"} feel like you. Publish when you're ready to share.`} actions={<Badge tone={saving || dirty ? "amber" : "green"}>{saving ? "Autosaving..." : dirty ? "Unsaved changes" : "All changes saved"}</Badge>} />
      </div>

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
        <ResetDraftButton siteId={siteId} onDone={() => void reload()} />
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
            <Card>
              <TabBody tab={tab} control={form.control} siteId={siteId} />
            </Card>
            <VersionsPanel siteId={siteId} onRestored={() => void reload()} />
          </div>
        )}
        {view !== "editor" && (
          <Card className="xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-hidden">
            <p className="mb-2 text-sm font-semibold text-slate-500">Live preview</p>
            <iframe title="Live preview" srcDoc={previewHtml} sandbox="allow-scripts" className="h-[70vh] w-full rounded border bg-white dark:border-slate-600" />
          </Card>
        )}
      </div>

      <UnsavedGuard when={dirty} />
    </div>
  );
}
