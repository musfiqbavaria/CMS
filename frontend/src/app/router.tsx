import { Suspense, lazy } from "react";
import { createBrowserRouter } from "react-router-dom";
import AdminLayout from "../app/layout/AdminLayout";
import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import LoginPage from "../features/auth/pages/LoginPage";
import ResetPasswordPage from "../features/auth/pages/ResetPasswordPage";

const DashboardPage = lazy(() => import("../features/dashboard/pages/DashboardPage"));
const EditorPage = lazy(() => import("../features/editor/pages/EditorPage"));
const MappingsPage = lazy(() => import("../features/connector/pages/MappingsPage"));
const SetupPage = lazy(() => import("../features/connector/pages/SetupPage"));
const MediaPage = lazy(() => import("../features/builder/pages/MediaPage"));
const MonitoringPage = lazy(() => import("../features/monitoring/MonitoringPage"));
const AuditPage = lazy(() => import("../features/audit/AuditPage"));
const UsersPage = lazy(() => import("../features/users/UsersPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));
const MenusPage = lazy(() => import("../features/builder/pages/MenusPage"));
const PageEditorPage = lazy(() => import("../features/builder/pages/PageEditorPage"));
const PagesPage = lazy(() => import("../features/builder/pages/PagesPage"));
const PostsPage = lazy(() => import("../features/builder/pages/PostsPage"));
const ProductsPage = lazy(() => import("../features/builder/pages/ProductsPage"));
const SectionsPage = lazy(() => import("../features/builder/pages/SectionsPage"));
const ThemesPage = lazy(() => import("../features/builder/pages/ThemesPage"));
const SitesPage = lazy(() => import("../features/sites/pages/SitesPage"));
const VerifyPage = lazy(() => import("../features/sites/pages/VerifyPage"));
const NewSitePage = lazy(() => import("../features/sites/pages/NewSitePage"));
const DomainsPage = lazy(() => import("../features/sites/pages/DomainsPage"));

function lazyPage(node: React.ReactNode) {
  return <Suspense fallback={<p className="p-4 text-sm text-slate-500">Loading…</p>}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
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
