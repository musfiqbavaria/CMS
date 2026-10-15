import { Link } from "react-router-dom";
import { Check, Palette } from "lucide-react";
import { useAssignTheme, useSiteTheme, useThemes } from "../api";
import { useBuilderStore } from "../../../stores/builder";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from "../../../shared/ui/kit";
import SitePicker from "../components/SitePicker";
import TemplatePreview from "../components/TemplatePreview";

export default function ThemesPage() {
  const siteId = useBuilderStore((state) => state.siteId);
  const { data: themes, isLoading, isError, refetch } = useThemes();
  const { data: current } = useSiteTheme(siteId);
  const assign = useAssignTheme(siteId as number);

  return (
    <div className="space-y-5">
      <PageHeader title="Set the tone" eyebrow="Visual themes" description="Find the colors and typography that feel right for your website." />
      <SitePicker hint="Choose the website you want to style" />
      <p className="text-xs text-[var(--muted)]">Looking for complete page layouts? Explore the <Link to="/templates" className="font-medium text-[var(--accent)] underline underline-offset-4">template collection</Link>.</p>
      {assign.isError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">The theme couldn't be applied. Please try again.</p>}
      {isLoading ? <div className="grid gap-5 md:grid-cols-2">{[0, 1].map((item) => <Skeleton key={item} className="h-96" />)}</div> : isError ? <EmptyState title="Themes couldn't load" action={<Button onClick={() => void refetch()}>Try again</Button>} /> : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(themes ?? []).map((theme) => {
            const colors = theme.settings.colors ?? {};
            const active = current?.theme === theme.id;
            return (
              <Card key={theme.id} className={active ? "ring-2 ring-blue-500/60" : ""}>
                <TemplatePreview name={theme.name} slug={theme.slug} colors={colors} font={theme.settings.fonts?.heading} />
                <div className="mt-5 flex flex-wrap items-center gap-2"><h2 className="mr-auto text-base font-semibold">{theme.name}</h2>{active ? <Badge tone="green"><Check size={11} /> Current theme</Badge> : theme.is_builtin && <Badge tone="slate">Included</Badge>}</div>
                <p className="mt-2 text-xs leading-6 text-[var(--muted)]">{theme.description}</p>
                <div className="my-5 flex flex-wrap items-center gap-2">{Object.entries(colors).map(([name, color]) => <span key={name} title={`${name}: ${color}`} className="h-6 w-6 rounded-full border border-black/10 shadow-sm" style={{ background: color }} />)}<span className="ml-1 text-[10px] text-[var(--muted)]">Color palette</span></div>
                <Button className="w-full" variant={active ? "secondary" : "primary"} disabled={!siteId || active || assign.isPending} onClick={() => assign.mutate(theme.id)}>{active ? "Currently applied" : !siteId ? "Select a website to apply" : assign.isPending ? "Applying..." : "Apply theme"}</Button>
                <details className="mt-4 text-[10px] text-[var(--muted)]"><summary className="cursor-pointer">Theme details</summary><pre className="mt-2 max-h-40 overflow-auto p-3">{JSON.stringify(theme.settings, null, 2)}</pre></details>
              </Card>
            );
          })}
          {themes?.length === 0 && <div className="md:col-span-2 xl:col-span-3"><EmptyState icon={Palette} title="No themes yet" hint="Available visual themes will appear here." /></div>}
        </div>
      )}
    </div>
  );
}
