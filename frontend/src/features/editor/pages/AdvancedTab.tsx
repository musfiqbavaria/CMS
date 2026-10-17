import { Link } from "react-router-dom";
import { Text } from "../components/fields";
import { useSite } from "../../sites/api";
import type { Control } from "react-hook-form";
import type { PageBlock, SiteConfigDraft } from "../types";

export function AdvancedTab({ control, siteId, blocks = [], onBlockRemove }: { control: Control<SiteConfigDraft>; siteId: number; blocks?: PageBlock[]; onBlockRemove?: (id: string) => void }) {
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
      <div className="space-y-2">
        <p className="font-medium">Page text areas</p>
        <p className="text-xs leading-5 text-[var(--muted)]">
          Text you made editable for a single page in the live preview. Removing one restores the original website text there.
        </p>
        {blocks.length ? (
          <ul className="space-y-1">
            {blocks.map((block) => (
              <li key={block.id} className="flex items-center gap-2 rounded border border-[var(--border)] px-2 py-1.5">
                <span className="font-mono text-xs">{block.path}</span>
                <span className="min-w-0 flex-1 truncate">{block.label || "Page text"}</span>
                {onBlockRemove && <button type="button" className="text-xs underline" onClick={() => onBlockRemove(block.id)}>Remove</button>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs leading-5 text-[var(--muted)]">
            None yet. In the live website preview, turn on Click to edit and click text that is not editable yet.
          </p>
        )}
      </div>
      <p>
        <Link to={`/websites/${siteId}/verify`} className="underline">
          Open connection & verification page
        </Link>
      </p>
    </div>
  );
}
