import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Euro,
  Lightbulb,
  MessageCircleReply,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatEur, formatHours } from "@/lib/format";

const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date());

function outcomeSourceLabel(source: string) {
  if (source === "user_reported") return "Déclaré par un utilisateur";
  if (source === "provider_observed") return "Observé par un fournisseur";
  if (source === "pilotzia_observed") return "Observé par Pilotzia";
  return source;
}

export default async function ResultsPage() {
  const company = await getCurrentCompany();

  const [automations, pendingOpportunities, outcomes] = await Promise.all([
    prisma.automation.findMany({ where: { companyId: company.id } }),
    prisma.opportunity.count({ where: { companyId: company.id, status: { in: ["detected", "viewed"] } } }),
    prisma.automationOutcome.findMany({
      where: { automation: { companyId: company.id } },
      include: { automation: { select: { id: true, name: true } } },
      orderBy: { observedAt: "desc" },
      take: 300,
    }),
  ]);

  const active = automations.filter((automation) => automation.status === "active");
  const healthy = automations.filter((automation) => automation.health === "green" && automation.status !== "inactive");
  const needsAttention = automations.filter(
    (automation) =>
      automation.health === "orange" ||
      automation.health === "red" ||
      automation.status === "warning" ||
      automation.status === "error"
  );
  const totalEstimatedHours = active.reduce((sum, automation) => sum + automation.estimatedHoursPerMonth, 0);
  const totalEstimatedValue = active.reduce((sum, automation) => sum + automation.estimatedValueEur, 0);
  const monitored = automations.filter((automation) => automation.status !== "inactive");
  const healthRate = monitored.length ? Math.round((healthy.length / monitored.length) * 100) : 100;

  // Les métriques continues (temps/valeur) sont des snapshots : on garde la dernière
  // déclaration par automatisation et par métrique pour éviter de les additionner dans le temps.
  const latestContinuous = new Map<string, (typeof outcomes)[number]>();
  for (const outcome of outcomes) {
    if (!["time_saved_weekly_hours", "value_observed_eur_30d"].includes(outcome.kind)) continue;
    const key = outcome.automationId + ":" + outcome.kind;
    if (!latestContinuous.has(key)) latestContinuous.set(key, outcome);
  }
  const continuousOutcomes = [...latestContinuous.values()];
  const timeOutcomes = continuousOutcomes.filter((outcome) => outcome.kind === "time_saved_weekly_hours");
  const valueOutcomes = continuousOutcomes.filter((outcome) => outcome.kind === "value_observed_eur_30d");
  const hasReportedTime = timeOutcomes.length > 0;
  const hasReportedValue = valueOutcomes.length > 0;
  const reportedHoursPerWeek = timeOutcomes.reduce((sum, outcome) => sum + outcome.value, 0);
  const reportedHoursPerMonth = reportedHoursPerWeek * 4.33;
  const reportedValue30d = valueOutcomes.reduce((sum, outcome) => sum + outcome.value, 0);

  // Les outcomes commerciaux sont événementiels : chaque occurrence représente un résultat
  // distinct enregistré sur un contact.
  const replies = outcomes
    .filter((outcome) => outcome.kind === "prospect_reply")
    .reduce((sum, outcome) => sum + outcome.value, 0);
  const meetings = outcomes
    .filter((outcome) => outcome.kind === "meeting_booked")
    .reduce((sum, outcome) => sum + outcome.value, 0);
  const wonDeals = outcomes
    .filter((outcome) => outcome.kind === "deal_won")
    .reduce((sum, outcome) => sum + outcome.value, 0);

  const hasMeasuredOrReportedResult = outcomes.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Valeur & preuve</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Résultats</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Pilotzia sépare ce qui a été réellement observé ou déclaré de ce qui reste une estimation. Une automatisation qui
          fonctionne techniquement n'est pas, à elle seule, une preuve de valeur métier.
        </p>
      </div>

      <Card className={hasMeasuredOrReportedResult ? "border-success/20" : ""}>
        <CardHeader>
          <CardTitle>Résultats constatés ou déclarés</CardTitle>
          <CardDescription>
            Chaque chiffre garde sa provenance. Une déclaration utilisateur n'est jamais présentée comme une mesure indépendante.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasMeasuredOrReportedResult ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Metric
                  icon={Clock3}
                  label="Temps déclaré économisé"
                  value={hasReportedTime ? "~" + formatHours(reportedHoursPerMonth) + "/mois" : "—"}
                />
                <Metric
                  icon={Euro}
                  label="Impact € déclaré · 30 j"
                  value={hasReportedValue ? formatEur(reportedValue30d) : "—"}
                />
                <Metric icon={MessageCircleReply} label="Réponses enregistrées" value={String(replies)} />
                <Metric icon={Target} label="Rendez-vous enregistrés" value={String(meetings)} />
                <Metric icon={Trophy} label="Opportunités gagnées" value={String(wonDeals)} />
              </div>

              <div className="mt-5 divide-y divide-border rounded-xl border border-border">
                {outcomes.slice(0, 10).map((outcome) => (
                  <div key={outcome.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{outcomeLabel(outcome.kind, outcome.value, outcome.unit)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {outcome.automation.name} · {outcome.actorName || outcome.actorEmail || "Pilotzia"} ·{" "}
                        {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(outcome.observedAt)}
                      </p>
                      {outcome.note && <p className="mt-2 text-xs leading-5 text-foreground/80">{outcome.note}</p>}
                    </div>
                    <Badge tone="neutral">{outcomeSourceLabel(outcome.source)}</Badge>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-5 text-sm leading-6 text-muted-foreground">
              Aucun résultat métier n'a encore été enregistré. Activez une automatisation, puis renseignez ou connectez une mesure
              réelle avant de considérer son potentiel comme un gain obtenu.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Potentiel estimé — {MONTH_LABEL}</CardTitle>
          <CardDescription>Projection distincte des résultats ci-dessus.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric icon={Clock3} label="Temps potentiel / mois" value={formatHours(totalEstimatedHours)} />
            <Metric icon={Euro} label="Valeur potentielle / mois" value={formatEur(totalEstimatedValue)} />
            <Metric icon={Zap} label="Automatisations actives" value={String(active.length)} />
            <Metric
              icon={healthy.length === monitored.length ? CheckCircle2 : AlertTriangle}
              label="Santé opérationnelle"
              value={monitored.length ? `${healthRate} %` : "—"}
            />
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Le temps et la valeur potentiels sont des estimations fondées sur les hypothèses de chaque automatisation. Ils ne sont
            pas additionnés aux résultats déclarés et ne constituent pas des économies comptables garanties.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryItem
              icon={healthy.length === monitored.length ? CheckCircle2 : AlertTriangle}
              title={needsAttention.length ? `${needsAttention.length} à surveiller` : "Fonctionnement normal"}
              body={
                needsAttention.length
                  ? "Certaines automatisations nécessitent votre attention avant de compter pleinement leur potentiel."
                  : monitored.length
                    ? "Aucune alerte opérationnelle détectée sur les automatisations suivies."
                    : "Aucune automatisation n'est encore suivie."
              }
            />
            <SummaryItem
              icon={Lightbulb}
              title={`${pendingOpportunities} opportunité${pendingOpportunities > 1 ? "s" : ""}`}
              body={
                pendingOpportunities
                  ? "De nouvelles améliorations sont prêtes à être examinées."
                  : "Aucune nouvelle opportunité en attente pour le moment."
              }
            />
            <SummaryItem
              icon={Zap}
              title={`${active.length} active${active.length > 1 ? "s" : ""}`}
              body="Une automatisation active prouve qu'un processus fonctionne techniquement, pas encore qu'il produit un résultat métier."
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {needsAttention.length > 0 && (
              <Link
                href="/app/automations"
                className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
              >
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
    </div>
  );
}

function outcomeLabel(kind: string, value: number, unit: string) {
  if (kind === "time_saved_weekly_hours") return `${value} h / semaine déclarées comme économisées`;
  if (kind === "value_observed_eur_30d") return `${formatEur(value)} déclarés sur 30 jours`;
  if (kind === "prospect_reply") return "Réponse prospect enregistrée";
  if (kind === "meeting_booked") return "Rendez-vous obtenu enregistré";
  if (kind === "deal_won") return "Opportunité gagnée enregistrée";
  if (kind === "deal_lost") return "Opportunité perdue enregistrée";
  return `${value} ${unit}`;
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
