import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateSite } from "../api";
import SiteFormModal from "../components/SiteFormModal";
import { useBuilderStore } from "../../../stores/builder";
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
      <h1 className="text-2xl font-bold">Add website</h1>
      <SiteFormModal
        open={true}
        site={null}
        busy={createSite.isPending}
        serverError={serverError}
        onClose={() => navigate("/websites")}
        onSubmit={submit}
        createMode="connected"
      />
    </div>
  );
}
