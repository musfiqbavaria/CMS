import { useEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowUpRight, ChevronRight, Layers, Plus, ShieldCheck, X } from "lucide-react";
import { MENU } from "../menu";
import { useAuthStore } from "../../stores/auth";
import { useUiStore } from "../../stores/ui";

function SidebarBody({ onNavigate, mobile = false }: { onNavigate?: () => void; mobile?: boolean }) {
  const storedCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const collapsed = storedCollapsed && !mobile;
  const user = useAuthStore((s) => s.user);
  const initial = (user?.username ?? "A").slice(0, 1).toUpperCase();

  return (
    <div className="flex h-full min-h-0 flex-col text-slate-300">
      <Link to="/" onClick={onNavigate} aria-label="CMS Platform dashboard" className={`flex h-20 shrink-0 items-center gap-3 px-5 ${collapsed ? "justify-center px-2" : ""}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-950/20"><Layers size={21} strokeWidth={1.8} aria-hidden="true" /></span>
        {!collapsed && <span><span className="block text-[14px] font-semibold tracking-tight text-white">CMS Platform</span><span className="mt-0.5 block text-[10px] text-slate-400">Your websites, together.</span></span>}
      </Link>

      {!collapsed && <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.035] px-3 py-2.5"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-400/10 text-[10px] font-semibold text-blue-200">W</span><span className="flex-1 text-[11px] font-medium text-slate-300">Admin workspace</span><ShieldCheck size={13} className="text-slate-500" aria-hidden="true" /></div>}

      <nav aria-label="Main navigation" className={`min-h-0 flex-1 overflow-y-auto px-3 pb-3 ${collapsed ? "px-2" : ""}`}>
        {MENU.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            {!collapsed && <p className="mb-2 px-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">{section.title}</p>}
            {section.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} title={collapsed ? item.label : undefined}
                className={({ isActive }) => `mb-1 flex min-h-9 items-center gap-3 rounded-lg px-3 py-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${isActive ? "bg-blue-600 font-semibold text-white shadow-sm" : "text-slate-400 hover:bg-white/5 hover:text-white"} ${collapsed ? "justify-center px-2" : ""}`}>
                <item.icon size={17} strokeWidth={1.7} className="shrink-0" aria-hidden="true" />
                {!collapsed && <><span className="flex-1 truncate">{item.label}</span><ChevronRight size={12} className="opacity-40" aria-hidden="true" /></>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {!collapsed && <div className="mx-4 mb-4 rounded-xl border border-white/[0.07] bg-white/[0.035] p-3"><p className="text-xs font-medium text-slate-200">Have something in mind?</p><p className="mt-1 text-[10px] leading-5 text-slate-400">Give your next idea a place online.</p><Link to="/builder/new" onClick={onNavigate} className="mt-2 flex items-center justify-between rounded-lg bg-white/[0.06] px-2.5 py-2 text-[11px] font-medium text-white transition hover:bg-white/10"><span className="flex items-center gap-1.5"><Plus size={13} aria-hidden="true" /> Create a website</span><ArrowUpRight size={13} aria-hidden="true" /></Link></div>}

      <Link to="/settings" onClick={onNavigate} aria-label="Account settings" className={`flex shrink-0 items-center gap-2.5 border-t border-white/[0.07] px-5 py-4 hover:bg-white/[0.03] ${collapsed ? "justify-center px-2" : ""}`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#273a59] text-xs font-semibold text-blue-100">{initial}</span>
        {!collapsed && <><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-200">{user?.first_name || user?.username || "Administrator"}</span><span className="mt-0.5 block truncate text-[10px] capitalize text-slate-500">{user?.role ?? "Workspace account"}</span></span><ChevronRight size={14} className="text-slate-500" aria-hidden="true" /></>}
      </Link>
    </div>
  );
}

export function SidebarDesktop() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  return <aside className={`hidden shrink-0 bg-[#101c33] transition-[width] duration-200 motion-reduce:transition-none lg:block ${collapsed ? "w-[76px]" : "w-[236px]"}`}><SidebarBody /></aside>;
}

export function SidebarMobile() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileNav(false);
      if (event.key !== "Tab") return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [open, setMobileNav]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setMobileNav(false)} aria-hidden="true" />
      <aside ref={panelRef} role="dialog" aria-modal="true" aria-label="Navigation" className="absolute bottom-0 left-0 top-0 w-[280px] max-w-[88vw] bg-[#101c33] shadow-2xl">
        <button type="button" aria-label="Close navigation" onClick={() => setMobileNav(false)} className="absolute right-2 top-6 z-10 rounded-lg p-1.5 text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"><X size={18} /></button>
        <SidebarBody mobile onNavigate={() => setMobileNav(false)} />
      </aside>
    </div>
  );
}
