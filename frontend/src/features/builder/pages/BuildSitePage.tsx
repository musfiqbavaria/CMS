import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteFormModal from "../../sites/components/SiteFormModal";
import type { SiteSchemaValues } from "../../sites/schemas";
import { useBuilderStore } from "../../../stores/builder";
import { useCreateSite } from "../../sites/api";
import { Card, CardTitle, PageHeader } from "../../../shared/ui/kit";

function serverMessage(err: unknown): string {
  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (data && typeof data === "object") {
    const first = Object.values(data as Record<string, unknown>)[0];
    if (Array.isArray(first)) return String(first[0]);
    if (typeof first === "string") return first;
  }
  return "Request failed. Try again.";
}

const STEPS = [
  { title: "Name it", text: "A free subdomain is generated automatically — or bring your own domain." },
  { title: "Pick a template", text: "Business, Portfolio, Store, Restaurant or Blog — pages, menu and homepage included." },
  { title: "Make it yours", text: "Theme, pages, menus, posts and products — then publish and share the link." },
];

/** Build flow entry: create a hosted site, then land on templates to start building. */
export default function BuildSitePage() {
  const navigate = useNavigate();
  const createSite = useCreateSite();
  const [serverError, setServerError] = useState<string | null>(null);

  function submit(values: SiteSchemaValues) {
    setServerError(null);
    createSite.mutate(values, {
      onSuccess: (site) => {
        useBuilderStore.getState().setSiteId(site.id);
        navigate("/templates");
      },
      onError: (e) => setServerError(serverMessage(e)),
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Build a website"
        description="A Google-Sites-style website hosted on this platform — free subdomain included."
        actions={<Link to="/builder" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600">← Builder overview</Link>}
      />
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SiteFormModal
            open={true}
            site={null}
            busy={createSite.isPending}
            serverError={serverError}
            onClose={() => navigate("/builder/pages")}
            onSubmit={submit}
            createMode="hosted"
            layout="inline"
          />
        </div>
        <div className="xl:col-span-2">
          <Card>
            <CardTitle>What happens next</CardTitle>
            <ol className="mt-3 space-y-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              Already own a website elsewhere?{" "}
              <Link to="/websites/new" className="underline">Connect it instead</Link> — no rebuilding needed.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
