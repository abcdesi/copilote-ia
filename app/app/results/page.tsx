import { Lock } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatEur, formatHours } from "@/lib/format";

const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date());

export default async function ResultsPage() {
  const company = await getCurrentCompany();

  const [automations, pendingOpportunities] = await Promise.all([
    prisma.automation.findMany({ where: { companyId: company.id } }),
    prisma.opportunity.count({ where: { companyId: company.id, status: { in: ["detected", "viewed"] } } }),
  ]);

  const active = automations.filter((a) => a.status === "active");
  const needsAttention = automations.filter((a) => a.status === "warning" || a.status === "error");
  const totalHours = active.reduce((s, a) => s + a.estimatedHoursPerMonth, 0);
  const totalValue = active.reduce((s, a) => s + a.estimatedValueEur, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Résultats</h1>
        <p className="mt-1 text-sm text-muted-foreground">Votre Automation Review, mois après mois.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="capitalize">Votre Automation Review — {MONTH_LABEL}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Ce mois-ci, vos automatisations actives représentent un potentiel estimé d&apos;environ{" "}
            <strong>{formatHours(totalHours)}</strong>, pour une valeur estimée de <strong>{formatEur(totalValue)}</strong>.
            {pendingOpportunities > 0 && (
              <>
                {" "}
                Nous avons détecté <strong>{pendingOpportunities}</strong> nouvelle
                {pendingOpportunities > 1 ? "s" : ""} opportunité{pendingOpportunities > 1 ? "s" : ""}.
              </>
            )}{" "}
            {needsAttention.length > 0 ? (
              <>
                <strong>{needsAttention.length}</strong> automatisation{needsAttention.length > 1 ? "s" : ""}{" "}
                nécessite{needsAttention.length > 1 ? "nt" : ""} votre attention.
              </>
            ) : (
              "Toutes vos automatisations fonctionnent normalement."
            )}
          </p>

          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Potentiel estimé" value={formatHours(totalHours)} />
            <MiniStat label="Valeur estimée" value={formatEur(totalValue)} />
            <MiniStat label="Automatisations actives" value={String(active.length)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Estimation basée sur le potentiel de vos automatisations actives — une automatisation qui rencontre des
            problèmes répétés sort de ce calcul et apparaît dans « à surveiller ».
          </p>

          {pendingOpportunities > 0 && (
            <a href="/app/opportunities" className="inline-block text-sm font-medium text-accent">
              Voir mes opportunités →
            </a>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/40">
        <CardContent className="pt-6 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold">🔒 Historique et rapports mensuels</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Chaque mois, votre Automation Review sera conservée ici pour suivre votre progression dans le temps.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
