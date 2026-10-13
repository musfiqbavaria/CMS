import { createBrowserRouter } from "react-router-dom";
import AdminLayout from "../app/layout/AdminLayout";
import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import LoginPage from "../features/auth/pages/LoginPage";
import ResetPasswordPage from "../features/auth/pages/ResetPasswordPage";
import DashboardPage from "../features/dashboard/pages/DashboardPage";
import EditorPage from "../features/editor/pages/EditorPage";
import MappingsPage from "../features/connector/pages/MappingsPage";
import SetupPage from "../features/connector/pages/SetupPage";
import SitesPage from "../features/sites/pages/SitesPage";
import VerifyPage from "../features/sites/pages/VerifyPage";
import StubPage from "../shared/ui/StubPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/websites", element: <SitesPage /> },
          { path: "/websites/new", element: <SitesPage startWithNew /> },
          { path: "/websites/:id/verify", element: <VerifyPage /> },
          { path: "/websites/:id/edit", element: <EditorPage /> },
          { path: "/websites/:id/setup", element: <SetupPage /> },
          { path: "/websites/:id/mappings", element: <MappingsPage /> },
          { path: "/builder/pages", element: <StubPage title="Pages" phase={7} /> },
          { path: "/builder/sections", element: <StubPage title="Sections" phase={7} /> },
          { path: "/builder/themes", element: <StubPage title="Themes" phase={7} /> },
          { path: "/builder/menus", element: <StubPage title="Menus" phase={7} /> },
          { path: "/media", element: <StubPage title="Media Library" phase={5} /> },
          { path: "/templates", element: <StubPage title="Templates" phase={7} /> },
          { path: "/monitoring", element: <StubPage title="Monitoring" phase={8} /> },
          { path: "/audit", element: <StubPage title="Audit Logs" phase={8} /> },
          { path: "/users", element: <StubPage title="Users & Roles" phase={8} /> },
          { path: "/settings", element: <StubPage title="Settings" phase={8} /> },
        ],
      },
    ],
  },
]);
