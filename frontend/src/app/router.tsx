import { Suspense, lazy } from "react";
import { Link, createBrowserRouter, useRouteError } from "react-router-dom";
import AdminLayout from "../app/layout/AdminLayout";
import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import LoginPage from "../features/auth/pages/LoginPage";
import ResetPasswordPage from "../features/auth/pages/ResetPasswordPage";

/**
 * Chunk-load failures happen when a new frontend bundle is deployed while a
 * tab still runs the previous one (old hashed asset URLs 404). Reload once
 * to pick up the fresh bundle; a session flag stops reload loops if the
 * chunk is genuinely broken.
 */
function resilient<T>(load: () => Promise<T>): () => Promise<T> {
  return () =>
    load().catch((err: unknown) => {
      if (!sessionStorage.getItem("chunk-reloaded")) {
        sessionStorage.setItem("chunk-reloaded", "1");
        window.location.reload();
      }
      throw err;
    });
}

function RouteError() {
  const error = useRouteError() as Error | null;
  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <h1 className="text-lg font-bold">Something went wrong</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {error?.message ?? "This page failed to load."} If the app was just
        updated, reloading picks up the latest version.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-slate-900"
        >
          Reload page
        </button>
        <Link
          to="/"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}

const DashboardPage = lazy(resilient(() => import("../features/dashboard/pages/DashboardPage")));
const EditorPage = lazy(resilient(() => import("../features/editor/pages/EditorPage")));
const MappingsPage = lazy(resilient(() => import("../features/connector/pages/MappingsPage")));
const SetupPage = lazy(resilient(() => import("../features/connector/pages/SetupPage")));
const MediaPage = lazy(resilient(() => import("../features/builder/pages/MediaPage")));
const MonitoringPage = lazy(resilient(() => import("../features/monitoring/MonitoringPage")));
const AuditPage = lazy(resilient(() => import("../features/audit/AuditPage")));
const UsersPage = lazy(resilient(() => import("../features/users/UsersPage")));
const SettingsPage = lazy(resilient(() => import("../features/settings/SettingsPage")));
const MenusPage = lazy(resilient(() => import("../features/builder/pages/MenusPage")));
const PageEditorPage = lazy(resilient(() => import("../features/builder/pages/PageEditorPage")));
const PagesPage = lazy(resilient(() => import("../features/builder/pages/PagesPage")));
const PostsPage = lazy(resilient(() => import("../features/builder/pages/PostsPage")));
const ProductsPage = lazy(resilient(() => import("../features/builder/pages/ProductsPage")));
const SectionsPage = lazy(resilient(() => import("../features/builder/pages/SectionsPage")));
const ThemesPage = lazy(resilient(() => import("../features/builder/pages/ThemesPage")));
const SitesPage = lazy(resilient(() => import("../features/sites/pages/SitesPage")));
const VerifyPage = lazy(resilient(() => import("../features/sites/pages/VerifyPage")));
const NewSitePage = lazy(resilient(() => import("../features/sites/pages/NewSitePage")));
const DomainsPage = lazy(resilient(() => import("../features/sites/pages/DomainsPage")));

function lazyPage(node: React.ReactNode) {
  return <Suspense fallback={<p className="p-4 text-sm text-slate-500">Loading…</p>}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteError />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: "/", element: lazyPage(<DashboardPage />) },
          { path: "/websites", element: lazyPage(<SitesPage />) },
          { path: "/websites/new", element: lazyPage(<NewSitePage />) },
          { path: "/websites/:id/verify", element: lazyPage(<VerifyPage />) },
          { path: "/websites/:id/domains", element: lazyPage(<DomainsPage />) },
          { path: "/websites/:id/edit", element: lazyPage(<EditorPage />) },
          { path: "/websites/:id/setup", element: lazyPage(<SetupPage />) },
          { path: "/websites/:id/mappings", element: lazyPage(<MappingsPage />) },
          { path: "/builder/pages", element: lazyPage(<PagesPage />) },
          { path: "/builder/pages/:pageId", element: lazyPage(<PageEditorPage />) },
          { path: "/builder/sections", element: lazyPage(<SectionsPage />) },
          { path: "/builder/themes", element: lazyPage(<ThemesPage />) },
          { path: "/builder/menus", element: lazyPage(<MenusPage />) },
          { path: "/builder/posts", element: lazyPage(<PostsPage />) },
          { path: "/builder/products", element: lazyPage(<ProductsPage />) },
          { path: "/media", element: lazyPage(<MediaPage />) },
          { path: "/templates", element: lazyPage(<ThemesPage />) },
          { path: "/monitoring", element: lazyPage(<MonitoringPage />) },
          { path: "/audit", element: lazyPage(<AuditPage />) },
          { path: "/users", element: lazyPage(<UsersPage />) },
          { path: "/settings", element: lazyPage(<SettingsPage />) },
        ],
      },
    ],
  },
]);