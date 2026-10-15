import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, ChevronRight, Code2, Globe2, Image, LayoutTemplate,
  Menu, Monitor, Paintbrush, PanelBottom, PanelTop, Search, Settings2,
  Share2, Smartphone, Sparkles, Tablet, type LucideIcon,
} from "lucide-react";
import { Card } from "../../../shared/ui/kit";
import { EDITOR_TABS, type EditorTabKey } from "../types";

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

export function EditorPreview({ html, onEdit }: { html: string; onEdit: () => void }) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const [availableWidth, setAvailableWidth] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const selected = DEVICES.find((item) => item.key === device)!;
  const scale = availableWidth > 0 ? Math.min(1, availableWidth / selected.width) : 1;

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
        <div><p className="ui-eyebrow">Your canvas</p><h2 className="ui-card-title">Draft preview</h2></div>
        <div role="group" aria-label="Preview device" className="site-editor-segmented">
          {DEVICES.map(({ key, label, icon: Icon }) => (
            <button type="button" key={key} aria-label={`${label} preview`} title={label} aria-pressed={device === key} onClick={() => setDevice(key)}><Icon size={16} aria-hidden="true" /></button>
          ))}
        </div>
      </div>
      <div className="site-editor-browser-bar"><span aria-hidden="true" className="site-editor-browser-dots"><i /><i /><i /></span><span>Template canvas</span><span className="ml-auto">{selected.width} px</span></div>
      <div className="site-editor-preview-stage">
        <div ref={viewport} className="site-editor-preview-viewport">
          <div className="site-editor-preview-frame" style={{ width: selected.width * scale, height: selected.height * scale }}>
            <iframe title="Draft preview" srcDoc={html} sandbox="allow-scripts" style={{ width: selected.width, height: selected.height, transform: `scale(${scale})` }} />
          </div>
        </div>
      </div>
      <div className="site-editor-preview-footer">
        <p>This template illustrates your settings, not your website’s exact layout. The connected website keeps its own HTML and selector mappings.</p>
        <button type="button" onClick={onEdit}>Back to editing <ArrowRight size={13} aria-hidden="true" /></button>
      </div>
    </Card>
  );
}
