import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCreateSite } from "../api";
import SiteFormModal from "../components/SiteFormModal";
import { useBuilderStore } from "../../../stores/builder";
import { Card, CardTitle, PageHeader } from "../../../shared/ui/kit";
import type { SiteSchemaValues } from "../schemas";

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
  { title: "Verify ownership", text: "Add the meta tag or DNS record we show you, then press verify." },
  { title: "We discover content", text: "Title, description, logo and theme colors are captured automatically." },
  { title: "Publish everywhere", text: "Use the connector snippet or reverse proxy to push CMS content live." },
];

/** Connect-flow entry: connect an existing external website. */
export default function NewSitePage() {
  const navigate = useNavigate();
  const createSite = useCreateSite();
  const [serverError, setServerError] = useState<string | null>(null);

  function submit(values: SiteSchemaValues) {
    setServerError(null);
    createSite.mutate(values, {
      onSuccess: (site) => {
        if (site.type === "connected") {
          navigate(`/websites/${site.id}/verify`);
        } else {
          useBuilderStore.getState().setSiteId(site.id);
          navigate("/templates");
        }
      },
      onError: (e) => setServerError(serverMessage(e)),
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Connect a website"
        description="Manage a site that already lives elsewhere — we discover it and verify ownership."
        actions={<Link to="/websites" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600">← All websites</Link>}
      />
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SiteFormModal
            open={true}
            site={null}
            busy={createSite.isPending}
            serverError={serverError}
            onClose={() => navigate("/websites")}
            onSubmit={submit}
            createMode="connected"
            layout="inline"
          />
        </div>
        <div className="xl:col-span-2">
          <Card>
            <CardTitle>How connecting works</CardTitle>
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
              Building a brand-new site instead?{" "}
              <Link to="/builder/new" className="underline">Start in the builder</Link> — it gets a free subdomain automatically.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
