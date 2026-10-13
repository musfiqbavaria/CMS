import { useNavigate } from "react-router-dom";
import { logout } from "../../auth/api";
import { useAuthStore } from "../../../stores/auth";

/** TEMPORARY landing page. Phase 2 replaces this with the full AdminLayout + Dashboard. */
export default function TempHomePage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  async function onLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-2xl rounded border bg-white p-6 shadow-sm">
        <p className="inline-block rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          TEMPORARY — Phase 2 builds the admin shell here
        </p>
        <h1 className="mt-3 text-2xl font-bold">Signed in</h1>
        <pre className="mt-3 rounded bg-slate-100 p-3 text-sm">
          {JSON.stringify(user, null, 2)}
        </pre>
        <button
          onClick={onLogout}
          className="mt-4 rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
