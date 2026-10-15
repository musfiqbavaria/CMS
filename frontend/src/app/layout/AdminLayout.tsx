import { Outlet } from "react-router-dom";
import { SidebarDesktop, SidebarMobile } from "./Sidebar";
import Topbar from "./Topbar";

export default function AdminLayout() {
  return (
    <div className="admin-shell flex overflow-hidden">
      <a href="#workspace-content" className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white focus:translate-y-0">Skip to content</a>
      <SidebarDesktop />
      <SidebarMobile />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="workspace-content" tabIndex={-1} className="app-content min-w-0 flex-1 overflow-y-auto px-4 py-6 outline-none sm:px-7 sm:py-8 xl:px-10">
          <div className="mx-auto w-full max-w-[1440px] pb-5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
