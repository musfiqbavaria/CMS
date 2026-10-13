import { useAssignTheme, useSiteTheme, useThemes } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import SitePicker from "../components/SitePicker";

export default function ThemesPage() {
  const siteId = useBuilderStore((s) => s.siteId);
  const { data: themes, isLoading } = useThemes();
  const { data: current } = useSiteTheme(siteId);
  const assign = useAssignTheme(siteId as number);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Themes</h1>
      <SitePicker hint="Assign a theme to the selected site" />
      {isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(themes ?? []).map((t) => {
            const colors = t.settings.colors ?? {};
            const active = current?.theme === t.id;
            return (
              <div key={t.id} className={`rounded-lg border p-4 dark:border-slate-700 ${active ? "ring-2 ring-slate-900 dark:ring-white" : ""}`}>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold">{t.name}</h2>
                  {t.is_builtin && <span className="rounded bg-slate-100 px-1.5 text-xs dark:bg-slate-700">built-in</span>}
                  {active && <span className="rounded bg-green-100 px-1.5 text-xs text-green-800">active</span>}
                </div>
                <p className="mt-1 text-sm text-slate-500">{t.description}</p>
                <div className="mt-2 flex gap-1">
                  {Object.values(colors).map((c, i) => (
                    <span key={i} title={String(c)} className="h-6 w-6 rounded border" style={{ background: String(c) }} />
                  ))}
                </div>
                <pre className="mt-2 max-h-32 overflow-y-auto rounded bg-slate-100 p-2 font-mono text-[11px] dark:bg-slate-700">
                  {JSON.stringify(t.settings, null, 1)}
                </pre>
                {siteId && !active && (
                  <button onClick={() => assign.mutate(t.id)} disabled={assign.isPending} className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">
                    Assign to site
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
