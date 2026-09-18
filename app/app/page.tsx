import { ArrowRight, Clock, Sparkles, TrendingUp, Zap } from "lucide-react";
import { getCurrentCompanyAccess } from "@/lib/companies/access";
import { getCompanyKnowledgeCoverage } from "@/lib/companies/knowledge-coverage";
import { getBusinessRhythmReminders } from "@/lib/business-graph/rhythms";
import { prisma } from "@/lib/db/client";
import { getLatestGoogleOperationalSnapshot } from "@/lib/integrations/observe";
import { deriveMarketingKpis, getLatestMarketingKpiSnapshot } from "@/lib/marketing/kpis";
import { getTrialJourneyState } from "@/lib/billing/trial-journey";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { RadarChart } from "@/components/knowledge/RadarChart";
import { Button } from "@/components/ui/Button";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { MorningBrief, MorningBriefItem, MorningBriefPriority, MorningBriefStats } from "@/components/dashboard/MorningBrief";
import { PilotziaFeed } from "@/components/dashboard/PilotziaFeed";
import { TrialJourney } from "@/components/dashboard/TrialJourney";
import { IMPACT_RANK, formatEur, formatHours, relativeTime } from "@/lib/format";

export default async function DashboardHomePage() {
  const access = await getCurrentCompanyAccess();
  const company = access.company;

  const [automations, opportunities, pendingActions, googleSnapshot, trialJourney, knowledge, outcomes, lastWeeklyRefresh, marketingSnapshot] = await Promise.all([
    prisma.automation.findMany({ where: { companyId: company.id }, orderBy: { installedAt: "desc" } }),
    prisma.opportunity.findMany({
      where: { companyId: company.id, status: { in: ["detected", "viewed"] } },
      orderBy: { estimatedValueEur: "desc" },
    }),
    prisma.pendingAction
      .findMany({
        where: { companyId: company.id, status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
      .catch((error) => {
        console.error("PendingAction unavailable on dashboard", error);
        return [];
      }),
    getLatestGoogleOperationalSnapshot(company.id).catch((error) => {
      console.error("Google operational snapshot unavailable on dashboard", error);
      return null;
    }),
    getTrialJourneyState(company.id),
    getCompanyKnowledgeCoverage(company.id),
    prisma.automationOutcome.findMany({
      where: { automation: { companyId: company.id } },
      orderBy: { observedAt: "desc" },
      take: 200,
    }),
    prisma.event.findFirst({
      where: { companyId: company.id, type: "WEEKLY_REFRESH_COMPLETED" },
      orderBy: { createdAt: "desc" },
    }),
    getLatestMarketingKpiSnapshot(company.id),
  ]);

  opportunities.sort((a, b) => IMPACT_RANK[b.impactLevel] - IMPACT_RANK[a.impactLevel] || b.estimatedValueEur - a.estimatedValueEur);

  const activeAutomations = automations.filter((a) => a.status === "active");
  const totalHours = activeAutomations.reduce((s, a) => s + a.estimatedHoursPerMonth, 0);
  const totalValue = activeAutomations.reduce((s, a) => s + a.estimatedValueEur, 0);
  const identifiedHours = Math.max(totalHours, opportunities.reduce((sum, opportunity) => sum + opportunity.estimatedHoursPerMonth, 0));

  const latestOutcomeByMetric = new Map<string, (typeof outcomes)[number]>();
  for (const outcome of outcomes) {
    const key = outcome.automationId + ":" + outcome.kind;
    if (!latestOutcomeByMetric.has(key)) latestOutcomeByMetric.set(key, outcome);
  }
  const latestOutcomes = [...latestOutcomeByMetric.values()];
  const timeOutcomes = latestOutcomes.filter((outcome) => outcome.kind === "time_saved_weekly_hours");
  const valueOutcomes = latestOutcomes.filter((outcome) => outcome.kind === "value_observed_eur_30d");
  const hasReportedTime = timeOutcomes.length > 0;
  const hasReportedValue = valueOutcomes.length > 0;
  const reportedHoursPerWeek = timeOutcomes.reduce((sum, outcome) => sum + outcome.value, 0);
  const reportedValue30d = valueOutcomes.reduce((sum, outcome) => sum + outcome.value, 0);
  const reportedHoursPerMonth = reportedHoursPerWeek * 4.33;

  const countable = automations.filter((a) => a.status !== "inactive");
  const healthCounts = {
    green: countable.filter((a) => a.health === "green").length,
    orange: countable.filter((a) => a.health === "orange").length,
    red: countable.filter((a) => a.health === "red").length,
  };
  const topOpportunity = opportunities[0];
  const moreOpportunities = opportunities.slice(1, 3);
  const firstName = access.session.user.name?.trim().split(/\s+/)[0] || access.session.user.email?.split("@")[0] || company.name;
  const rhythmReminders = getBusinessRhythmReminders(company);

  const attentionCount = healthCounts.orange + healthCounts.red;
  const healthRate = countable.length ? Math.round((healthCounts.green / countable.length) * 100) : null;
  const marketingKpis = marketingSnapshot ? deriveMarketingKpis(marketingSnapshot) : null;
  const briefItems: MorningBriefItem[] = [];

  if (attentionCount > 0) {
    briefItems.push({
      bucket: "decide",
      tone: "danger",
      text: `${attentionCount} automatisation${attentionCount > 1 ? "s nécessitent" : " nécessite"} votre attention`,
      href: "/app/automations",
    });
  }
  for (const rhythm of rhythmReminders) {
    const timing = rhythm.daysUntil === 0 ? "est attendue maintenant" : `revient dans environ ${rhythm.daysUntil} jour${rhythm.daysUntil > 1 ? "s" : ""}`;
    briefItems.push({
      bucket: "know",
      tone: "accent",
      text: `${rhythm.title} ${timing} — Pilotzia l'a repéré comme un rythme récurrent à anticiper`,
      href: `/app/company#${rhythm.domain}`,
    });
  }
  if (googleSnapshot && googleSnapshot.unreadInboxLast7Days > 0) {
    briefItems.push({
      bucket: "know",
      tone: "accent",
      text: `${googleSnapshot.unreadInboxIsEstimate ? "Environ " : ""}${googleSnapshot.unreadInboxLast7Days} email${googleSnapshot.unreadInboxLast7Days > 1 ? "s" : ""} non lu${googleSnapshot.unreadInboxLast7Days > 1 ? "s" : ""} dans Gmail sur les 7 derniers jours`,
      href: "/app/tools",
    });
  }
  if (marketingSnapshot && marketingKpis?.roas != null) {
    briefItems.push({
      bucket: "know",
      tone: "accent",
      text: `Marketing : ROAS déclaré ${marketingKpis.roas.toFixed(2)}× sur le dernier instantané`,
      href: "/app/marketing",
    });
  }
  if (opportunities.length > 0) {
    briefItems.push({
      bucket: "know",
      tone: "accent",
      text: `${opportunities.length} opportunité${opportunities.length > 1 ? "s" : ""} en attente, potentiel ~${formatHours(
        opportunities.reduce((s, o) => s + o.estimatedHoursPerMonth, 0)
      )}/mois`,
      href: "/app/opportunities",
    });
  }
  if (attentionCount === 0 && activeAutomations.length > 0) {
    briefItems.push({
      bucket: "handled",
      tone: "success",
      text: `Vos ${activeAutomations.length} automatisation${activeAutomations.length > 1 ? "s" : ""} fonctionnent normalement`,
      href: "/app/automations",
    });
  }
  if (briefItems.length === 0) {
    briefItems.push({
      bucket: "know",
      tone: "accent",
      text: "Décrivez une tâche qui vous fait perdre du temps à votre copilote pour recevoir vos premières recommandations",
      href: "/app/copilot",
    });
  }

  const briefStats: MorningBriefStats | undefined =
    countable.length > 0 || opportunities.length > 0
      ? {
          opportunitiesCount: opportunities.length,
          potentialHoursLabel: `${formatHours(opportunities.reduce((s, o) => s + o.estimatedHoursPerMonth, 0))}`,
          healthRatioLabel: `${healthCounts.green}/${countable.length}`,
        }
      : undefined;

  let briefPriority: MorningBriefPriority | undefined;
  if (pendingActions[0]) {
    briefPriority = {
      title: pendingActions[0].title,
      description: "Pilotzia a préparé cette action. Vérifiez son impact puis confirmez ou refusez son exécution.",
      href: "/app/actions",
      isHighImpact: pendingActions[0].riskLevel === "high" || pendingActions[0].riskLevel === "critical",
    };
  } else if (rhythmReminders[0] && rhythmReminders[0].daysUntil <= 14) {
    briefPriority = {
      title: `Anticiper : ${rhythmReminders[0].title}`,
      description: "Ce rythme revient bientôt d'après le contexte mémorisé. Vérifiez qu'il est toujours d'actualité puis préparez les actions utiles avant le pic.",
      href: `/app/company#${rhythmReminders[0].domain}`,
      isHighImpact: false,
    };
  } else if (topOpportunity) {
    briefPriority = {
      title: topOpportunity.title,
      description: "Je peux préparer cette automatisation et vous montrer le résultat avant son activation.",
      href: `/app/opportunities/${topOpportunity.id}`,
      isHighImpact: topOpportunity.impactLevel === "high",
    };
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <MorningBrief firstName={firstName} items={briefItems} stats={briefStats} priority={briefPriority} />

      <Card>
        <CardHeader>
          <CardTitle>Pilotage de direction</CardTitle>
          <CardDescription>Quatre signaux courts, en séparant strictement les résultats observés des estimations.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Sparkles} label="Décisions à valider" value={String(pendingActions.length)} />
          <Stat icon={Clock} label="Temps observé / mois" value={hasReportedTime ? "~" + formatHours(reportedHoursPerMonth) : "À mesurer"} />
          <Stat icon={TrendingUp} label="Impact observé · 30 j" value={hasReportedValue ? formatEur(reportedValue30d) : "À mesurer"} />
          <Stat icon={Zap} label="Santé automatisations" value={healthRate == null ? "Aucune active" : `${healthRate}%`} />
        </CardContent>
      </Card>

      {marketingSnapshot && marketingKpis && (
        <Card className="border-accent/20">
          <CardHeader>
            <CardTitle>Acquisition marketing</CardTitle>
            <CardDescription>Dernier instantané déclaré — aucune donnée publicitaire n&apos;est présentée comme synchronisée sans connecteur live.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={TrendingUp} label="Revenu attribué" value={formatEur(marketingSnapshot.revenueEur)} />
            <Stat icon={Clock} label="Dépenses" value={formatEur(marketingSnapshot.spendEur)} />
            <Stat icon={Sparkles} label="ROAS" value={marketingKpis.roas == null ? "—" : `${marketingKpis.roas.toFixed(2)}×`} />
            <Stat icon={Zap} label="CAC" value={marketingKpis.cacEur == null ? "—" : formatEur(marketingKpis.cacEur)} />
          </CardContent>
        </Card>
      )}

      <TrialJourney
        paid={trialJourney.usage.paid}
        trialStartedAt={trialJourney.usage.trialStartedAt}
        trialEndsAt={trialJourney.usage.trialEndsAt}
        trialActive={trialJourney.usage.trialActive}
        trialExpired={trialJourney.usage.trialExpired}
        creditsUsed={trialJourney.usage.creditsUsed}
        creditsLimit={trialJourney.usage.creditsLimit}
        hasCompanyContext={trialJourney.hasCompanyContext}
        hasConnection={trialJourney.hasConnection}
        opportunitiesCount={opportunities.length}
        pendingActionsCount={pendingActions.length}
        activeAutomationsCount={activeAutomations.length}
        hasMeasuredOutcome={outcomes.length > 0}
        totalHoursPerMonth={identifiedHours}
      />

      <Card className="border-accent/20 bg-accent-soft">
        <CardContent className="grid gap-5 pt-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
          <div className="flex flex-col items-center text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Connaissance de votre entreprise</p>
            <div className="mt-1 text-3xl font-semibold">{knowledge.overall}%</div>
            <RadarChart items={knowledge.radar} size={265} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Plus le contexte est riche, plus les conseils deviennent précis</h2>
            <p className="mt-2 text-sm leading-6 text-foreground/75">{knowledge.message}</p>
            {knowledge.nextSection && (
              <div className="mt-4 rounded-xl border border-border bg-card/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Prochaine information utile</p>
                <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{knowledge.nextSection.label} · {knowledge.nextSection.score}%</p>
                    <p className="mt-1 text-xs text-muted-foreground">{knowledge.nextSection.description}</p>
                  </div>
                  <Button href={knowledge.nextSection.href} size="sm">Compléter</Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {googleSnapshot && (
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniOperationalStat label="Emails non lus · 7 jours" value={`${googleSnapshot.unreadInboxIsEstimate ? "~" : ""}${googleSnapshot.unreadInboxLast7Days}`} />
          <MiniOperationalStat label="Événements · 7 jours" value={String(googleSnapshot.upcomingEventsNext7Days)} />
          <MiniOperationalStat label="Observation Google" value="Synchronisée" />
        </div>
      )}

      {(outcomes.length > 0 || lastWeeklyRefresh) && (
        <Card className="border-success/20">
          <CardHeader>
            <CardTitle>Résultats observés & fraîcheur</CardTitle>
            <CardDescription>
              Les résultats déclarés restent séparés des estimations. Le contexte opérationnel est rafraîchi automatiquement chaque semaine.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Stat
              icon={Clock}
              label="Temps déclaré économisé"
              value={hasReportedTime ? "~" + formatHours(reportedHoursPerMonth) + "/mois" : "Non renseigné"}
            />
            <Stat
              icon={TrendingUp}
              label="Impact € déclaré · 30 j"
              value={hasReportedValue ? formatEur(reportedValue30d) : "Non renseigné"}
            />
            <Stat
              icon={Sparkles}
              label="Dernier refresh hebdo"
              value={lastWeeklyRefresh ? relativeTime(lastWeeklyRefresh.createdAt) : "À venir"}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Automatisation actuelle</CardTitle>
            <CardDescription>Un indicateur de maturité des automatisations, distinct de la qualité du contexte entreprise.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-semibold">{company.automationScore}</span>
              <span className="pb-1 text-sm text-muted-foreground">/100</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Ce score ne mesure pas la qualité de vos données. La jauge ci-dessus indique ce que Pilotzia connaît réellement pour mieux vous conseiller.
            </p>
          </CardContent>
        </Card>

        {activeAutomations.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Potentiel estimé des automatisations actives</CardTitle>
              <CardDescription>Estimations mensuelles fondées sur le temps déclaré ou modélisé — ce ne sont pas encore des gains réalisés.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat icon={Clock} label="Temps potentiel / mois" value={formatHours(totalHours)} />
                <Stat icon={TrendingUp} label="Valeur potentielle / mois" value={formatEur(totalValue)} />
                <Stat icon={Zap} label="Automatisations actives" value={String(activeAutomations.length)} />
                <Stat icon={Sparkles} label="Indice de santé" value={`${healthCounts.green}/${countable.length}`} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2 text-sm">
                <span>🟢 {healthCounts.green} fonctionnent normalement</span>
                <span className="text-muted-foreground">·</span>
                <span>🟠 {healthCounts.orange} nécessite votre attention</span>
                <span className="text-muted-foreground">·</span>
                <span>🔴 {healthCounts.red} problème critique</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex flex-col justify-center border-accent/20 bg-accent-soft">
            <CardContent className="pt-6">
              <p className="text-sm font-semibold text-accent">Vous n&apos;avez pas encore d&apos;automatisation active</p>
              <p className="mt-1.5 text-sm text-foreground/80">
                Commencez par valider une opportunité pertinente ; Pilotzia pourra ensuite mesurer ce qui fonctionne réellement.
              </p>
              <div className="mt-4">
                <Button href="/app/opportunities" size="sm">
                  Voir mes opportunités <ArrowRight size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {moreOpportunities.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Recommandations personnalisées</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {moreOpportunities.map((opportunity) => (
              <OpportunityCard key={opportunity.id} opportunity={opportunity} />
            ))}
          </div>
        </div>
      )}

      <PilotziaFeed companyId={company.id} />
    </div>
  );
}

function MiniOperationalStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
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