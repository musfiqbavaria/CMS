import type { CSSProperties } from "react";

const palettes: Record<string, { background: string; ink: string; heading: string; detail: string }> = {
  business: { background: "#e3ecf9", ink: "#244775", heading: "Ideas into impact.", detail: "A new perspective on business" },
  portfolio: { background: "#e3ece3", ink: "#345a43", heading: "Made to stand out.", detail: "A collection of meaningful work" },
  store: { background: "#f3e6da", ink: "#825335", heading: "Find your everyday.", detail: "Thoughtfully selected, just for you" },
  restaurant: { background: "#f3e0de", ink: "#85443f", heading: "Gather around.", detail: "Good food. Better company." },
  blog: { background: "#f3edd5", ink: "#75602e", heading: "Stories worth sharing.", detail: "A little curiosity goes a long way" },
};

export default function TemplatePreview({ slug, name, colors, font }: { slug: string; name: string; colors?: Record<string, string>; font?: string }) {
  const palette = palettes[slug] ?? palettes.business;
  const style = { "--preview-bg": colors?.background ?? palette.background, "--preview-ink": colors?.text ?? palette.ink, fontFamily: font } as CSSProperties;
  return (
    <div aria-hidden="true" className="template-preview" style={style}>
      <div className="flex items-center justify-between border-b border-current/10 pb-3"><span className="text-[9px] font-bold tracking-tight">{name}</span><span className="flex gap-1.5"><span className="h-0.5 w-4 rounded bg-current opacity-30" /><span className="h-0.5 w-4 rounded bg-current opacity-30" /><span className="h-0.5 w-4 rounded bg-current opacity-30" /></span></div>
      <p className="mt-5 max-w-[170px] text-[23px] font-semibold leading-[1.05] tracking-[-0.05em]">{palette.heading}</p>
      <p className="mt-2 max-w-[170px] text-[8px] opacity-70">{palette.detail}</p>
      <span className="mt-3 inline-flex rounded bg-current px-3 py-1"><span className="h-0.5 w-5 bg-[var(--preview-bg)]" /></span>
    </div>
  );
}
