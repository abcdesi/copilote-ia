import { BarChart3, CircleDollarSign, MousePointerClick, Target, UsersRound } from "lucide-react";
import { getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { getLatestMarketingKpiSnapshot, deriveMarketingKpis } from "@/lib/marketing/kpis";
import { saveMarketingKpiSnapshotAction } from "@/lib/marketing/actions";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatEur } from "@/lib/format";

const MARKETING_TOOLS = ["Google Analytics 4", "Google Ads", "Meta Ads", "LinkedIn Ads"] as const;

function formatMetric(value: number | null, suffix = "") {
  if (value == null || !Number.isFinite(value)) return "Non calculable";
  return `${value.toFixed(value >= 10 ? 1 : 2)}${suffix}`;
}

export default async function MarketingPage() {
  const access = await getCurrentCompanyAccess();
  const snapshot = await getLatestMarketingKpiSnapshot(access.company.id);
  const derived = snapshot ? deriveMarketingKpis(snapshot) : null;
  const canEdit = hasCompanyPermission(access.role, "edit_company");
  const knownTools = new Set(access.company.tools.map((tool) => tool.name));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Acquisition & performance</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Pilotage marketing</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Un instantané chiffré pour raisonner sur les dépenses, les leads, les clients et le revenu sans inventer de données.
          Tant que les connecteurs publicitaires ne sont pas actifs, les chiffres saisis ici restent explicitement déclaratifs.
        </p>
      </div>

      {snapshot ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Instantané marketing</CardTitle>
                  <CardDescription>
                    Données déclarées · {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.observedAt))}
                  </CardDescription>
                </div>
                <Badge tone="accent">Source manuelle</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Metric icon={CircleDollarSign} label="Dépenses" value={formatEur(snapshot.spendEur)} />
              <Metric icon={MousePointerClick} label="Leads" value={String(snapshot.leads)} />
              <Metric icon={Target} label="Conversions" value={String(snapshot.conversions)} />
              <Metric icon={UsersRound} label="Clients" value={String(snapshot.customers)} />
              <Metric icon={BarChart3} label="Revenu attribué" value={formatEur(snapshot.revenueEur)} />
            </CardContent>
          </Card>

          <Card className="border-accent/20">
            <CardHeader>
              <CardTitle>KPI calculés</CardTitle>
              <CardDescription>Calculs déterministes à partir de l&apos;instantané ci-dessus.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label="CPL" value={derived?.cplEur == null ? "—" : formatEur(derived.cplEur)} />
              <Kpi label="CPA" value={derived?.cpaEur == null ? "—" : formatEur(derived.cpaEur)} />
              <Kpi label="CAC" value={derived?.cacEur == null ? "—" : formatEur(derived.cacEur)} />
              <Kpi label="ROAS" value={derived?.roas == null ? "—" : formatMetric(derived.roas, "×")} />
              <Kpi label="Lead → client" value={derived?.leadToCustomerRate == null ? "—" : formatMetric(derived.leadToCustomerRate, "%")} />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-accent/20 bg-accent-soft">
          <CardHeader>
            <CardTitle>Aucun KPI marketing observé</CardTitle>
            <CardDescription>
              Ajoutez un premier instantané pour que le dashboard et le Copilote puissent raisonner sur des chiffres réels plutôt que sur des hypothèses.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>{snapshot ? "Actualiser les KPI" : "Ajouter les KPI"}</CardTitle>
            <CardDescription>
              Utilisez une même période de référence pour les cinq champs, par exemple les 30 derniers jours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveMarketingKpiSnapshotAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field name="spendEur" label="Dépenses €" defaultValue={snapshot?.spendEur} />
              <Field name="leads" label="Leads" defaultValue={snapshot?.leads} step="1" />
              <Field name="conversions" label="Conversions" defaultValue={snapshot?.conversions} step="1" />
              <Field name="customers" label="Clients acquis" defaultValue={snapshot?.customers} step="1" />
              <Field name="revenueEur" label="Revenu attribué €" defaultValue={snapshot?.revenueEur} />
              <div className="sm:col-span-2 lg:col-span-5">
                <Button type="submit">Enregistrer l&apos;instantané</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sources marketing</CardTitle>
          <CardDescription>
            Pilotzia distingue ce qui est simplement déclaré de ce qui est réellement synchronisé par API.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {MARKETING_TOOLS.map((tool) => {
            const definition = getIntegrationDefinition(tool);
            const known = knownTools.has(tool);
            return (
              <div key={tool} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{tool}</p>
                  <Badge tone={known ? "accent" : "warning"}>{known ? "Renseigné" : "À renseigner"}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{definition.permissionLabel}</p>
                <p className="mt-2 text-[11px] font-medium text-muted-foreground">Connexion API live : non activée</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  step = "0.01",
}: {
  name: string;
  label: string;
  defaultValue?: number;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        min="0"
        step={step}
        required
        defaultValue={typeof defaultValue === "number" ? String(defaultValue) : undefined}
      />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon size={14} />
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
