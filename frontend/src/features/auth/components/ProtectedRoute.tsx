import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../../stores/auth";

export default function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Checking session…</p>
      </div>
    );
  }
  if (status === "anonymous") return <Navigate to="/login" replace />;
  return <Outlet />;
}
