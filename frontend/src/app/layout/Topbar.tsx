import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, CheckCheck, ChevronDown, ChevronRight, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Sun } from "lucide-react";
import { ALL_ENTRIES } from "../menu";
import { logout } from "../../features/auth/api";
import { markAllNotificationsRead } from "../../features/notifications/useNotificationsSocket";
import { useAuthStore } from "../../stores/auth";
import { unreadCount, useNotificationsStore } from "../../stores/notifications";
import { useUiStore } from "../../stores/ui";
import { timeAgo } from "../../shared/ui/kit";

const iconButton = "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-slate-800";
const popover = "fixed right-4 top-[76px] z-50 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_12px_48px_-12px_rgba(15,23,42,0.25)] sm:absolute sm:right-0 sm:top-full sm:mt-3";

export default function Topbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const notifications = useNotificationsStore((s) => s.items);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const entry = ALL_ENTRIES.find((item) => item.to === pathname)
    ?? [...ALL_ENTRIES].sort((a, b) => b.to.length - a.to.length).find((item) => item.to !== "/" && pathname.startsWith(item.to + "/"));
  const pageName = /\/websites\/\d+\/edit/.test(pathname) ? "Site editor" : entry?.label ?? "Workspace";
  const matches = query.trim()
    ? ALL_ENTRIES.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 7)
    : ALL_ENTRIES.filter((item) => ["/", "/websites", "/builder", "/media"].includes(item.to));

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (!searchRef.current?.contains(target)) setSearchOpen(false);
      if (!bellRef.current?.contains(target)) setBellOpen(false);
      if (!profileRef.current?.contains(target)) setProfileOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "") && !target?.isContentEditable) {
        event.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape") { setSearchOpen(false); setBellOpen(false); setProfileOpen(false); }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => { setSearchOpen(false); setBellOpen(false); setProfileOpen(false); }, [pathname]);

  function openResult(to: string) { navigate(to); setSearchOpen(false); setQuery(""); setActiveResult(0); }
  async function onLogout() {
    try { await logout(); } catch { /* The local session is cleared by logout even if the server is unreachable. */ }
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex h-20 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-4 sm:gap-3 sm:px-7 xl:px-10">
      <button type="button" aria-label="Open navigation" onClick={() => setMobileNav(true)} className={`${iconButton} lg:hidden`}><Menu size={19} /></button>
      <button type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleSidebar} className={`${iconButton} hidden lg:flex`}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
      <div className="flex min-w-0 items-center gap-2 text-xs"><span className="hidden text-[var(--muted)] xl:block">Workspace</span><ChevronRight size={12} className="hidden text-slate-400 xl:block" aria-hidden="true" /><span className="truncate font-medium">{pageName}</span></div>
      <div className="flex-1" />

      <div ref={searchRef} className="relative hidden w-[210px] shrink-0 md:block xl:w-[260px]">
        <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input ref={searchInputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); setActiveResult(0); }} onFocus={() => setSearchOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActiveResult((value) => Math.max(0, Math.min(value + 1, matches.length - 1))); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveResult((value) => Math.max(0, value - 1)); }
            if (event.key === "Enter" && searchOpen && matches[activeResult]) { event.preventDefault(); openResult(matches[activeResult].to); }
          }}
          role="combobox" aria-label="Search workspace pages" aria-autocomplete="list" aria-expanded={searchOpen} aria-controls="workspace-search-results" aria-activedescendant={searchOpen && matches.length ? `search-result-${activeResult}` : undefined}
          placeholder="Search workspace..." className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] pl-9 pr-8 text-xs outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10" />
        <kbd aria-hidden="true" className="absolute right-2.5 top-2 rounded border border-[var(--line)] px-1 text-[10px] text-slate-400">/</kbd>
        {searchOpen && <div className="absolute right-0 z-50 mt-3 w-[300px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl"><p className="px-2 pb-2 pt-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--muted)]">{query ? "Search results" : "Quick navigation"}</p><ul id="workspace-search-results" role="listbox">{matches.map((match, index) => <li key={match.to} id={`search-result-${index}`} role="option" aria-selected={activeResult === index}><button type="button" onClick={() => openResult(match.to)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs ${activeResult === index ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "hover:bg-[var(--surface-soft)]"}`}><match.icon size={15} aria-hidden="true" />{match.label}<ChevronRight size={12} className="ml-auto opacity-50" aria-hidden="true" /></button></li>)}</ul>{matches.length === 0 && <p className="p-3 text-xs text-[var(--muted)]">No pages found. Try another name.</p>}</div>}
      </div>

      <Link to="/websites/new" className="ui-button hidden md:flex" data-variant="primary"><Plus size={14} aria-hidden="true" /><span className="hidden xl:inline">Add website</span><span className="xl:hidden">Add</span></Link>
      <span className="mx-1 hidden h-6 w-px bg-[var(--line)] sm:block" />
      <button type="button" aria-label="Toggle color theme" onClick={toggleTheme} className={iconButton}>{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button>

      <div ref={bellRef} className="relative">
        <button type="button" aria-label="Notifications" aria-expanded={bellOpen} onClick={() => { setBellOpen((value) => !value); setProfileOpen(false); }} className={`${iconButton} relative`}><Bell size={18} />{unreadCount(notifications) > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-[var(--surface)] bg-rose-500" />}</button>
        {bellOpen && <div className={`${popover} w-[min(360px,calc(100vw-32px))]`}>
          <div className="flex items-center justify-between border-b border-[var(--line)] p-3"><p className="text-sm font-semibold">Notifications</p><button type="button" onClick={() => void markAllNotificationsRead()} aria-label="Mark all notifications read" className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--surface-soft)]"><CheckCheck size={16} /></button></div>
          {notifications.length === 0 ? <div className="px-5 py-9 text-center"><Bell size={24} className="mx-auto mb-3 text-slate-400" aria-hidden="true" /><p className="text-xs font-medium">You're all caught up</p><p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">Site health and publishing updates will appear here.</p></div> : <ul className="max-h-80 overflow-y-auto">{notifications.map((notification) => <li key={notification.id} className="border-b border-[var(--line)] p-3 last:border-0"><p className={`text-xs leading-5 ${notification.read ? "text-[var(--muted)]" : "font-medium"}`}>{notification.title}</p><p className="mt-1 text-[10px] text-[var(--muted)]" title={new Date(notification.createdAt).toLocaleString()}>{timeAgo(notification.createdAt)}</p></li>)}</ul>}
        </div>}
      </div>

      <div ref={profileRef} className="relative ml-1">
        <button type="button" aria-label="Profile menu" aria-expanded={profileOpen} onClick={() => { setProfileOpen((value) => !value); setBellOpen(false); }} className="flex items-center gap-2 rounded-lg p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">{(user?.username ?? "A").slice(0, 1).toUpperCase()}</span><ChevronDown size={12} className="hidden text-slate-400 sm:block" aria-hidden="true" /></button>
        {profileOpen && <div className={`${popover} w-60`}><div className="border-b border-[var(--line)] px-3 py-3"><p className="text-xs font-semibold">{user?.first_name || user?.username}</p><p className="mt-1 truncate text-[11px] text-[var(--muted)]">{user?.email}</p><p className="mt-1 text-[10px] capitalize text-blue-500">{user?.role}</p></div><Link to="/settings" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs hover:bg-[var(--surface-soft)]"><Settings size={14} aria-hidden="true" /> Account settings</Link><button type="button" onClick={() => void onLogout()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"><LogOut size={14} aria-hidden="true" /> Sign out</button></div>}
      </div>
    </header>
  );
}
