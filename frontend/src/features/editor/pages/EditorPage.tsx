import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, Globe2, LayoutPanelLeft, Loader2, Monitor, PanelLeft, Plug, Rocket, Save, X } from "lucide-react";
import { usePatchDraft, usePublish, useSaveDraft, useEditorConfig } from "../api";
import { ResetDraftButton, UnsavedGuard, VersionsPanel } from "../components/VersionControls";
import { configToHtml, isDirty } from "../preview";
import type { EditorTabKey, SiteConfigDraft } from "../types";
import { useSite } from "../../sites/api";
import { publicSiteUrl } from "../../sites/links";
import { BrandingTab, CoverTab, FooterTab, GeneralTab, HeaderTab, SeoTab } from "../tabsA";
import { CustomTab, HeroTab, NavTab, SocialTab, ThemeTab } from "../tabsB";
import { Badge, Button, Card, PageHeader, Spinner } from "../../../shared/ui/kit";
import { EditorPreview, EditorSections, SECTION_DETAILS, SECTION_GROUPS, sectionLabel } from "../components/EditorWorkspace";
import { AdvancedTab } from "./AdvancedTab";
import { cmsOrigin, isLocalCmsOrigin } from "../../connector/snippet";
import "../editor.css";

const sectionOrder = SECTION_GROUPS.flatMap((group) => group.sections);
const editorViews = [
  { key: "editor", label: "Editor", icon: PanelLeft },
  { key: "split", label: "Split", icon: LayoutPanelLeft },
  { key: "preview", label: "Preview", icon: Monitor },
] as const;

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

  if (isLoading) return <Spinner label="Loading your editor…" />;
  if (isError || !config || validId === null) {
    return (
      <Card>
        <p className="text-sm text-red-600">Site not found.</p>
        <Link to="/websites" className="text-sm underline">Back to Websites</Link>
      </Card>
    );
  }

  const SectionIcon = SECTION_DETAILS[tab].icon;
  const nextSection = sectionOrder[sectionOrder.indexOf(tab) + 1];
  const liveUrl = site ? site.public_url || publicSiteUrl(site.domain) : null;

  return (
    <div className="site-editor space-y-4">
      <div>
        <Link to="/websites" className="site-editor-back"><ArrowLeft size={13} aria-hidden="true" /> All websites</Link>
        <PageHeader title="Website editor" eyebrow="Create with confidence" description="Your content, your style. Bring it all together, one section at a time." actions={<Badge tone="blue">Connected website</Badge>} />
      </div>

      <Card className="site-editor-context">
        <span className="ui-icon-well"><Globe2 size={21} aria-hidden="true" /></span>
        <div className="site-editor-context-name"><h2>{site?.name ?? "Your website"}</h2><p>{site?.domain ?? "Connected website"}</p></div>
        <Badge tone={config.published_version_no != null ? "green" : "slate"}>{config.published_version_no != null ? `Published v${config.published_version_no}` : "Not published yet"}</Badge>
        <div className="site-editor-context-links">
          <Link to={`/websites/${siteId}/setup`} className="ui-button" data-variant="secondary"><Plug size={14} aria-hidden="true" /> Connection</Link>
          {liveUrl && <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="ui-button" data-variant="secondary">Open website <ArrowUpRight size={14} aria-hidden="true" /></a>}
        </div>
      </Card>

      {localOnly && <div role="status" className="site-editor-notice" data-tone="local"><CircleAlert size={16} aria-hidden="true" /><p><strong>Local testing mode.</strong> Publish saves changes in this CMS; it does not upload files to {site?.domain ?? "your website"}. Public visitors need a publicly reachable HTTPS CMS. <Link to={`/websites/${siteId}/setup`} className="font-semibold underline">Check connector setup</Link>.</p></div>}

      {banner && (
        <div role={banner.kind === "ok" ? "status" : "alert"} className="site-editor-notice" data-tone={banner.kind}>
          {banner.kind === "ok" ? <CheckCircle2 size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
          <p>{banner.text}</p><button type="button" aria-label="Dismiss message" onClick={() => setBanner(null)}><X size={16} aria-hidden="true" /></button>
        </div>
      )}

      <div className="site-editor-toolbar">
        <div className="site-editor-status" role="status">
          {saving ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
          <span>{saving ? "Autosaving your draft…" : dirty ? "Draft changes · autosave on" : "Draft saved · autosave on"}</span>
        </div>
        <div className="site-editor-toolbar-actions">
          <div role="group" aria-label="Workspace view" className="site-editor-segmented">
            {editorViews.map(({ key, label, icon: Icon }) => <button type="button" key={key} aria-pressed={view === key} onClick={() => setView(key)}><Icon size={14} aria-hidden="true" />{label}</button>)}
          </div>
          <Button onClick={onSaveDraft} disabled={busy}><Save size={14} aria-hidden="true" />{operation === "save" ? "Saving…" : "Save draft"}</Button>
          <Button variant="primary" onClick={onPublish} disabled={busy}><Rocket size={14} aria-hidden="true" />{operation === "publish" ? "Publishing…" : "Publish changes"}</Button>
        </div>
      </div>

      <div className="site-editor-layout" data-view={view}>
        {view !== "preview" && (
          <div className="site-editor-settings">
            <EditorSections active={tab} onSelect={setTab} />
            <div className="site-editor-form-column space-y-4">
              <section id="editor-section-content" aria-labelledby="editor-section-heading">
                <Card>
                  <div className="site-editor-form-heading">
                    <span className="ui-icon-well"><SectionIcon size={19} aria-hidden="true" /></span>
                    <div><h2 id="editor-section-heading" className="ui-card-title">{sectionLabel(tab)}</h2><p>{SECTION_DETAILS[tab].description}</p></div>
                  </div>
                  <fieldset disabled={busy} className="site-editor-fields">
                    <legend className="sr-only">{sectionLabel(tab)} settings</legend>
                    <TabBody tab={tab} control={form.control} siteId={siteId} seededTitle={String(site?.discovery?.title || site?.name || "")} />
                  </fieldset>
                  <div className="site-editor-form-footer">
                    <p>Changes stay in your draft until you publish.</p>
                    {nextSection && <Button onClick={() => setTab(nextSection)}>Next: {sectionLabel(nextSection)} <ArrowRight size={13} aria-hidden="true" /></Button>}
                  </div>
                </Card>
              </section>
              <Card>
                <h2 className="ui-card-title">Save a checkpoint</h2>
                <p className="mt-1 text-xs leading-6 text-[var(--muted)]">Keep a named version you can return to later.</p>
                <div className="site-editor-checkpoint mt-4">
                  <label>Version note <span className="font-normal">(optional)</span><input disabled={busy} value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Updated homepage imagery" /></label>
                  <Button onClick={onSaveDraft} disabled={busy}><Save size={14} aria-hidden="true" />{operation === "save" ? "Saving…" : "Save version"}</Button>
                </div>
              </Card>
              <fieldset disabled={busy || saving} className="contents"><VersionsPanel siteId={siteId} onRestored={() => void reload()} /></fieldset>
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <p className="text-xs text-[var(--muted)]">Want to start from the published settings?</p>
                <fieldset disabled={busy || saving} className="contents"><ResetDraftButton siteId={siteId} onDone={() => void reload()} /></fieldset>
              </div>
            </div>
          </div>
        )}
        {view !== "editor" && <EditorPreview html={previewHtml} liveUrl={liveUrl} onEdit={() => setView("editor")} />}
      </div>

      <UnsavedGuard when={dirty} />
    </div>
  );
}
