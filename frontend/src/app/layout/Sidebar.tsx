import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { MENU } from "../menu";
import { useAuthStore } from "../../stores/auth";
import { useUiStore } from "../../stores/ui";

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const user = useAuthStore((s) => s.user);
  const initial = (user?.username ?? "A").slice(0, 1).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-4 dark:border-slate-700">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-bold text-white dark:from-white dark:to-slate-300 dark:text-slate-900">
          {initial}
        </span>
        {!collapsed && (
          <span className="leading-tight">
            <span className="block text-sm font-bold">CMS Platform</span>
            <span className="block text-[11px] text-slate-400">Site manager</span>
          </span>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {MENU.map((section) => (
          <div key={section.title} className="mb-3">
            {!collapsed && (
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
            )}
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onNavigate}
                title={item.label}
                className={({ isActive }) =>
                  `mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-slate-900 font-medium text-white shadow-sm dark:bg-white dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60"
                  } ${collapsed ? "justify-center" : ""}`
                }
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3 text-xs text-slate-400 dark:border-slate-700">
        {!collapsed && <p className="truncate">Signed in as <span className="font-medium text-slate-500 dark:text-slate-300">{user?.username}</span></p>}
      </div>
    </div>
  );
}

export function SidebarDesktop() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  return (
    <aside
      className={`hidden shrink-0 border-r border-slate-200 bg-white transition-all dark:border-slate-700 dark:bg-slate-800 lg:block ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <SidebarBody />
    </aside>
  );
}

export function SidebarMobile() {
  const open = useUiStore((s) => s.mobileNavOpen);
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNav(false)} />
      <aside className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-slate-800">
        <button
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
          className="absolute right-2 top-3 rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <X size={20} />
        </button>
        <SidebarBody onNavigate={() => setMobileNav(false)} />
      </aside>
    </div>
  );
}
