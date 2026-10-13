import { useEffect, useState } from "react";

type Health = { status: string; db: string; redis: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health/")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setHealth(await r.json());
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl p-8">
        <h1 className="text-3xl font-bold">CMS Platform — Phase 0</h1>
        <p className="mt-2 text-slate-600">
          Foundation scaffold. Admin shell, auth, and builder arrive in later phases.
        </p>
        <div className="mt-6 rounded border bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Backend health (/api/health/)</h2>
          {health && (
            <pre className="mt-2 rounded bg-slate-100 p-3 text-sm">
              {JSON.stringify(health, null, 2)}
            </pre>
          )}
          {error && <p className="mt-2 text-sm text-red-600">Error: {error}</p>}
          {!health && !error && <p className="mt-2 text-sm">Loading…</p>}
        </div>
        <div className="mt-4 rounded border bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Verify</h2>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>
              API: <code>/api/health/</code> returns status/db/redis
            </li>
            <li>
              Connector stub: <code>/connector/v1/ping/</code>
            </li>
            <li>
              WS echo: <code>ws://&lt;host&gt;/ws/echo/</code>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
