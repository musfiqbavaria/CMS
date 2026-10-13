import { createBrowserRouter } from "react-router-dom";
import AdminLayout from "../app/layout/AdminLayout";
import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import LoginPage from "../features/auth/pages/LoginPage";
import ResetPasswordPage from "../features/auth/pages/ResetPasswordPage";
import DashboardPage from "../features/dashboard/pages/DashboardPage";
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
          { path: "/websites", element: <StubPage title="Websites" phase={3} hint="Connected + built site list with search, filters and bulk actions." /> },
          { path: "/websites/new", element: <StubPage title="Add Website" phase={3} hint="Connect by domain or start building a new site." /> },
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
