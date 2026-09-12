import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Euro, Lightbulb, Lock, Zap } from "lucide-react";
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
  const healthy = automations.filter((a) => a.health === "green" && a.status !== "inactive");
  const needsAttention = automations.filter((a) => a.health === "orange" || a.health === "red" || a.status === "warning" || a.status === "error");
  const totalHours = active.reduce((s, a) => s + a.estimatedHoursPerMonth, 0);
  const totalValue = active.reduce((s, a) => s + a.estimatedValueEur, 0);
  const monitored = automations.filter((a) => a.status !== "inactive");
  const healthRate = monitored.length ? Math.round((healthy.length / monitored.length) * 100) : 100;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Valeur & fiabilité</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Résultats</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Suivez ce que Pilotzia estime avoir récupéré en temps, la valeur associée et surtout la santé des automatisations qui produisent ces résultats.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Clock3} label="Temps estimé récupéré" value={formatHours(totalHours)} />
        <Metric icon={Euro} label="Valeur estimée" value={formatEur(totalValue)} />
        <Metric icon={Zap} label="Automatisations actives" value={String(active.length)} />
        <Metric icon={healthy.length === monitored.length ? CheckCircle2 : AlertTriangle} label="Santé opérationnelle" value={`${healthRate} %`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="capitalize">Automation Review — {MONTH_LABEL}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6">
            <p>
              Vos automatisations actives représentent actuellement un potentiel estimé d'environ <strong>{formatHours(totalHours)}</strong>, soit <strong>{formatEur(totalValue)}</strong> de valeur indicative sur le mois.
            </p>
            <p className="mt-2 text-muted-foreground">
              Ces montants sont des estimations fondées sur le temps de travail déclaré ou modélisé. Ils ne sont pas présentés comme des économies comptables garanties.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryItem
              icon={healthy.length === monitored.length ? CheckCircle2 : AlertTriangle}
              title={needsAttention.length ? `${needsAttention.length} à surveiller` : "Fonctionnement normal"}
              body={needsAttention.length ? "Certaines automatisations nécessitent votre attention avant de compter pleinement leur valeur." : "Aucune alerte opérationnelle détectée sur les automatisations suivies."}
            />
            <SummaryItem
              icon={Lightbulb}
              title={`${pendingOpportunities} opportunité${pendingOpportunities > 1 ? "s" : ""}`}
              body={pendingOpportunities ? "De nouvelles améliorations sont prêtes à être examinées." : "Aucune nouvelle opportunité en attente pour le moment."}
            />
            <SummaryItem
              icon={Zap}
              title={`${active.length} active${active.length > 1 ? "s" : ""}`}
              body="Seules les automatisations actives alimentent l'estimation principale de valeur."
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {needsAttention.length > 0 && (
              <Link href="/app/automations" className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
                Traiter les alertes
              </Link>
            )}
            {pendingOpportunities > 0 && (
              <Link href="/app/opportunities" className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium">
                Voir les opportunités
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/40">
        <CardContent className="flex items-start gap-3 pt-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold">Historique mensuel en préparation</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              L'objectif est de conserver les Automation Reviews pour comparer la progression dans le temps sans inventer de tendance avant d'avoir suffisamment de données réelles.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Icon size={16} className="text-muted-foreground" />
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SummaryItem({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <Icon size={16} className="text-accent" />
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}
