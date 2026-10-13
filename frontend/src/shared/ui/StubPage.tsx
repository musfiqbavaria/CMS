import { Link } from "react-router-dom";

/** Placeholder for pages owned by later phases. Never a silent dead end. */
export default function StubPage({ title, phase, hint }: { title: string; phase: number; hint?: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="inline-block rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        Coming in Phase {phase}
      </p>
      <h1 className="mt-3 text-2xl font-bold">{title}</h1>
      {hint && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
      <Link to="/" className="mt-4 inline-block rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
        Back to Dashboard
      </Link>
    </div>
  );
}
