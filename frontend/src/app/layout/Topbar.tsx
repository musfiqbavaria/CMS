import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronsLeft, ChevronsRight, LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { ALL_ENTRIES } from "../menu";
import { logout } from "../../features/auth/api";
import { markAllNotificationsRead } from "../../features/notifications/useNotificationsSocket";
import { useAuthStore } from "../../stores/auth";
import { unreadCount, useNotificationsStore } from "../../stores/notifications";
import { useUiStore } from "../../stores/ui";
import { timeAgo } from "../../shared/ui/kit";

export default function Topbar() {
  const navigate = useNavigate();
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
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setBellOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const matches =
    query.trim().length === 0
      ? []
      : ALL_ENTRIES.filter((e) => e.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8);

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800 sm:px-4">
      <button
        aria-label="Open navigation"
        onClick={() => setMobileNav(true)}
        className="rounded p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 lg:hidden"
      >
        <Menu size={20} />
      </button>
      <button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={toggleSidebar}
        className="hidden rounded p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 lg:block"
      >
        {collapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
      </button>

      <div ref={searchRef} className="relative hidden flex-1 sm:block sm:max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={searchInputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search pages…  ( / )"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white dark:focus:border-slate-400 dark:focus:ring-slate-600"
        />
        {searchOpen && matches.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full rounded border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
            {matches.map((m) => (
              <li key={m.to}>
                <button
                  onClick={() => {
                    navigate(m.to);
                    setSearchOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <m.icon size={16} className="text-slate-400" />
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex-1 sm:hidden" />

      <button
        aria-label="Toggle color theme"
        onClick={toggleTheme}
        className="rounded p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      <div className="relative">
        <button
          aria-label="Notifications"
          onClick={() => {
            setBellOpen((v) => !v);
            setProfileOpen(false);
          }}
          className="relative rounded p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Bell size={20} />
          {unreadCount(notifications) > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unreadCount(notifications)}
            </span>
          )}
        </button>
        {bellOpen && (
          <div className="absolute right-0 z-50 mt-1 w-72 rounded border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-700">
              <p className="text-sm font-semibold">Notifications</p>
              <button onClick={() => void markAllNotificationsRead()} className="text-xs text-slate-500 underline">
                Mark all read
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">
                All clear. Uptime, SSL and connector alerts appear here live.
              </p>
            ) : (
              <ul className="max-h-64 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id} className="border-b border-slate-100 px-3 py-2 text-sm last:border-0 dark:border-slate-700">
                    <p className={n.read ? "text-slate-500" : "font-medium"}>{n.title}</p>
                    <p className="text-xs text-slate-400" title={new Date(n.createdAt).toLocaleString()}>{timeAgo(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          aria-label="Profile menu"
          onClick={() => {
            setProfileOpen((v) => !v);
            setBellOpen(false);
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
        >
          {(user?.username ?? "A").slice(0, 1).toUpperCase()}
        </button>
        {profileOpen && (
          <div className="absolute right-0 z-50 mt-1 w-56 rounded border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
              <p className="text-sm font-semibold">{user?.username}</p>
              <p className="text-xs text-slate-500">
                {user?.email} · {user?.role}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
