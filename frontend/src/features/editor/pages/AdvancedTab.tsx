import { Link } from "react-router-dom";
import { Text } from "../components/fields";
import { useSite } from "../../sites/api";
import type { Control } from "react-hook-form";
import type { SiteConfigDraft } from "../types";

export function AdvancedTab({ control, siteId }: { control: Control<SiteConfigDraft>; siteId: number }) {
  const { data: site } = useSite(siteId);
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-2 sm:grid-cols-2">
        <div><dt className="text-slate-500">Domain</dt><dd className="font-mono">{site?.domain}</dd></div>
        <div><dt className="text-slate-500">Site key</dt><dd className="font-mono text-xs">{site?.site_key}</dd></div>
        <div><dt className="text-slate-500">Integration mode</dt><dd>{site?.integration_mode}</dd></div>
        <div><dt className="text-slate-500">Verification</dt><dd>{site?.verification_status}</dd></div>
      </dl>
      <Text label="Site name (general)" name="general.site_name" control={control} />
      <p>
        <Link to={`/websites/${siteId}/verify`} className="underline">
          Open connection & verification page
        </Link>
      </p>
    </div>
  );
}
