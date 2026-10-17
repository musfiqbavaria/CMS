import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, ChevronRight, Code2, Globe2, Image, LayoutTemplate,
  Menu, Monitor, MousePointer2, Paintbrush, PanelBottom, PanelTop, Search, Settings2,
  Share2, Smartphone, Sparkles, Tablet, type LucideIcon,
} from "lucide-react";
import { Card } from "../../../shared/ui/kit";
import { EDITOR_TABS, type EditorTabKey } from "../types";
import { editableDraft, editorMessage, EDIT_TARGETS, isCmsPreview, liveEditUrl, type EditTargetKey } from "../clickToEdit";

export const SECTION_DETAILS: Record<EditorTabKey, { icon: LucideIcon; description: string }> = {
  general: { icon: Globe2, description: "Give your website a name and a short introduction." },
  branding: { icon: Image, description: "Choose the logo and browser icon that represent your brand." },
  header: { icon: PanelTop, description: "Shape your first impression with a logo, layout, and call to action." },
  navigation: { icon: Menu, description: "Help visitors find their way with clear, useful menu links." },
  hero: { icon: Sparkles, description: "Make your opening message stand out with words, imagery, and buttons." },
  cover: { icon: LayoutTemplate, description: "Set a cover image and fine-tune its overlay." },
  footer: { icon: PanelBottom, description: "Finish your pages with helpful links and your copyright details." },
  theme: { icon: Paintbrush, description: "Bring your identity together with a consistent color palette and fonts." },
  seo: { icon: Search, description: "Control how your website appears in browser tabs and shared links." },
  social: { icon: Share2, description: "Connect visitors with the places they can follow your work." },
  custom: { icon: Code2, description: "Add custom CSS or JavaScript to your connected website." },
  advanced: { icon: Settings2, description: "Review your website details and connection settings." },
};

export const SECTION_GROUPS: { label: string; sections: EditorTabKey[] }[] = [
  { label: "Site identity", sections: ["general", "branding", "theme"] },
  { label: "Page sections", sections: ["header", "navigation", "hero", "cover", "footer"] },
  { label: "More settings", sections: ["seo", "social", "custom", "advanced"] },
];

export function sectionLabel(key: EditorTabKey) {
  return EDITOR_TABS.find((section) => section.key === key)!.label;
}

export function EditorSections({ active, onSelect }: { active: EditorTabKey; onSelect: (key: EditorTabKey) => void }) {
  return (
    <Card className="site-editor-nav">
      <div className="site-editor-nav-heading">
        <p className="text-sm font-semibold">Make it your own</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Choose a section to edit.</p>
      </div>
      <div className="site-editor-section-picker">
        <label htmlFor="editor-section" className="sr-only">Choose an editor section</label>
        <select id="editor-section" value={active} onChange={(event) => onSelect(event.target.value as EditorTabKey)}>
          {SECTION_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.sections.map((key) => <option key={key} value={key}>{sectionLabel(key)}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <nav aria-label="Editor sections" className="site-editor-section-list">
        {SECTION_GROUPS.map((group) => (
          <div key={group.label} className="site-editor-nav-group">
            <p>{group.label}</p>
            {group.sections.map((key) => {
              const Icon = SECTION_DETAILS[key].icon;
              return (
                <button type="button" key={key} aria-pressed={active === key} aria-controls="editor-section-content" onClick={() => onSelect(key)}>
                  <Icon size={16} aria-hidden="true" />
                  <span>{sectionLabel(key)}</span>
                  {active === key && <ChevronRight size={13} className="ml-auto shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="site-editor-nav-hint"><Sparkles size={14} aria-hidden="true" /><p>Your changes autosave as a draft. Publish when you’re ready.</p></div>
    </Card>
  );
}

const DEVICES = [
  { key: "desktop", label: "Desktop", icon: Monitor, width: 1280, height: 900 },
  { key: "tablet", label: "Tablet", icon: Tablet, width: 768, height: 1024 },
  { key: "mobile", label: "Mobile", icon: Smartphone, width: 390, height: 844 },
] as const;

export function EditorPreview({ html, liveUrl, onEdit, onSelect, selectedKey }: {
  html: string;
  liveUrl: string | null;
  onEdit: () => void;
  onSelect?: (key: EditTargetKey) => void;
  selectedKey?: EditTargetKey | null;
}) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const [source, setSource] = useState<"draft" | "live">("draft");
  const [availableWidth, setAvailableWidth] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const scrollMemory = useRef({ draft: 0, live: 0 });
  const [editMode, setEditMode] = useState(true);
  const [connection, setConnection] = useState<{ channel: string; count: number | null; slow: boolean }>({ channel: "", count: null, slow: false });
  const [unmapped, setUnmapped] = useState(false);
  const selected = DEVICES.find((item) => item.key === device)!;
  const scale = availableWidth > 0 ? Math.min(1, availableWidth / selected.width) : 1;
  const showingLive = source === "live" && liveUrl !== null;
  const editable = !!onSelect && (!showingLive || isCmsPreview(liveUrl));
  const documentKey = showingLive ? liveUrl : html;
  const channel = useMemo(() => Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join(""), [documentKey, source]);
  const draftHtml = useMemo(() => editable ? editableDraft(html, channel) : html, [editable, html, channel]);
  const liveSrc = showingLive && editable ? liveEditUrl(liveUrl, channel) : liveUrl;
  const connected = connection.channel === channel && connection.count !== null;
  const waiting = connection.channel === channel && connection.slow;
  const scrollSource = showingLive ? "live" : "draft";

  const configure = useCallback(() => {
    iframe.current?.contentWindow?.postMessage({
      type: "cms:editor:configure", channel, enabled: editMode,
      key: selectedKey ?? null, y: scrollMemory.current[scrollSource],
    }, "*"); // The sandbox has an opaque origin; the recipient validates source, origin and channel.
  }, [channel, editMode, selectedKey, scrollSource]);

  useEffect(() => {
    if (!editable) return;
    function receive(event: MessageEvent) {
      const message = editorMessage(event, iframe.current?.contentWindow ?? null, channel);
      if (!message) return;
      if (message.type === "ready") {
        setConnection({ channel, count: message.count, slow: false });
        configure();
      } else if (message.type === "scroll") {
        scrollMemory.current[scrollSource] = message.y;
      } else if (message.type === "select" && editMode) {
        setUnmapped(false);
        onSelect?.(message.key);
      } else if (message.type === "unmapped" && editMode) {
        setUnmapped(true);
      }
    }
    window.addEventListener("message", receive);
    configure();
    const timer = setTimeout(() => setConnection((current) => current.channel === channel && current.count !== null ? current : { channel, count: null, slow: true }), 20_000);
    return () => { window.removeEventListener("message", receive); clearTimeout(timer); };
  }, [editable, channel, configure, editMode, onSelect, scrollSource]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setAvailableWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <Card className="site-editor-preview">
      <div className="site-editor-preview-heading">
        <div><p className="ui-eyebrow">Your canvas</p><h2 className="ui-card-title">{showingLive ? "Live website" : "Draft preview"}</h2></div>
        <div className="flex flex-wrap items-center gap-2">
          {liveUrl && (
            <div role="group" aria-label="Preview source" className="site-editor-segmented">
              <button type="button" aria-pressed={!showingLive} onClick={() => setSource("draft")}>Draft design</button>
              <button type="button" aria-pressed={showingLive} onClick={() => setSource("live")}>Live website</button>
            </div>
          )}
          {onSelect && <button type="button" className="ui-button site-editor-inspect-toggle" data-variant={editMode && editable ? "primary" : "secondary"} disabled={!editable} aria-pressed={editMode && editable} onClick={() => { setEditMode((current) => !current); setUnmapped(false); }}><MousePointer2 size={14} aria-hidden="true" />Click to edit</button>}
          {showingLive && editable && (
            <div role="group" aria-label="Preview page history" className="site-editor-segmented">
              <button type="button" aria-label="Back" title="Back to the previous page you browsed" onClick={() => iframe.current?.contentWindow?.postMessage({ type: "cms:editor:back", channel }, "*")}><ArrowLeft size={16} aria-hidden="true" /></button>
              <button type="button" aria-label="Forward" title="Forward to the next page you browsed" onClick={() => iframe.current?.contentWindow?.postMessage({ type: "cms:editor:forward", channel }, "*")}><ArrowRight size={16} aria-hidden="true" /></button>
            </div>
          )}
          <div role="group" aria-label="Preview device" className="site-editor-segmented">
            {DEVICES.map(({ key, label, icon: Icon }) => (
              <button type="button" key={key} aria-label={`${label} preview`} title={label} aria-pressed={device === key} onClick={() => setDevice(key)}><Icon size={16} aria-hidden="true" /></button>
            ))}
          </div>
        </div>
      </div>
      {onSelect && <div className="site-editor-inspector-status" role="status" aria-live="polite" data-warning={unmapped || waiting || (connected && connection.count === 0)}>
        <MousePointer2 size={14} aria-hidden="true" />
        <p>{!editable ? "Use Draft design or a verified CMS website preview for click-to-edit." : !editMode ? (showingLive ? "Selection is off. Links browse the live pages here; forms and scripts stay disabled." : "Selection is off. Preview links and forms remain disabled.") : waiting ? "The inspector has not connected. Try Draft design or check your preview connection." : !connected ? "Connecting the preview inspector…" : connection.count === 0 ? "No mapped areas found. Review selector mappings or use Draft design." : unmapped ? "This area is not mapped. Choose a section from the editor or update its selector mapping." : selectedKey ? <><strong>{EDIT_TARGETS[selectedKey].label}</strong> selected. Edit its settings in the panel.</> : "Hover or tab to an area, then click or press Enter to edit its settings. Ctrl/⌘+click a link to browse the site."}</p>
      </div>}
      <div className="site-editor-browser-bar"><span aria-hidden="true" className="site-editor-browser-dots"><i /><i /><i /></span><span>{showingLive ? liveUrl : "Template canvas"}</span><span className="ml-auto">{selected.width} px</span></div>
      <div className="site-editor-preview-stage">
        <div ref={viewport} className="site-editor-preview-viewport">
          <div className="site-editor-preview-frame" style={{ width: selected.width * scale, height: selected.height * scale }}>
            {showingLive ? (
              <iframe ref={iframe} title="Live website preview" src={liveSrc!} sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" onLoad={() => iframe.current?.contentWindow?.postMessage({ type: "cms:editor:ping", channel }, "*")} style={{ width: selected.width, height: selected.height, transform: `scale(${scale})` }} />
            ) : (
              <iframe ref={iframe} title="Draft preview" srcDoc={draftHtml} sandbox="allow-scripts" referrerPolicy="no-referrer" onLoad={() => iframe.current?.contentWindow?.postMessage({ type: "cms:editor:ping", channel }, "*")} style={{ width: selected.width, height: selected.height, transform: `scale(${scale})` }} />
            )}
          </div>
        </div>
      </div>
      <div className="site-editor-preview-footer">
        {showingLive ? (
          <p>Read-only original layout. Website scripts, forms and API calls are disabled. Links browse the original pages here (turn off Click to edit) or open in a real tab (Ctrl/⌘+click); Back and Forward revisit pages you already browsed. Changes stay in your draft until you publish.</p>
        ) : (
          <p>This template illustrates your settings, not your website’s exact layout. The connected website keeps its own HTML and selector mappings.</p>
        )}
        <button type="button" onClick={onEdit}>Back to editing <ArrowRight size={13} aria-hidden="true" /></button>
      </div>
    </Card>
  );
}
