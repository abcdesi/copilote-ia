import { ArrowRight, Clock, Sparkles, TrendingUp, Zap } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { Button } from "@/components/ui/Button";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { MorningBrief, MorningBriefItem, MorningBriefPriority, MorningBriefStats } from "@/components/dashboard/MorningBrief";
import { PilotziaFeed } from "@/components/dashboard/PilotziaFeed";
import { IMPACT_RANK, formatEur, formatHours } from "@/lib/format";

export default async function DashboardHomePage() {
  const company = await getCurrentCompany();

  const [automations, opportunities] = await Promise.all([
    prisma.automation.findMany({ where: { companyId: company.id }, orderBy: { installedAt: "desc" } }),
    prisma.opportunity.findMany({
      where: { companyId: company.id, status: { in: ["detected", "viewed"] } },
      orderBy: { estimatedValueEur: "desc" },
    }),
  ]);

  opportunities.sort((a, b) => IMPACT_RANK[b.impactLevel] - IMPACT_RANK[a.impactLevel] || b.estimatedValueEur - a.estimatedValueEur);

  const activeAutomations = automations.filter((a) => a.status === "active");
  const totalHours = activeAutomations.reduce((s, a) => s + a.estimatedHoursPerMonth, 0);
  const totalValue = activeAutomations.reduce((s, a) => s + a.estimatedValueEur, 0);

  const countable = automations.filter((a) => a.status !== "inactive");
  const healthCounts = {
    green: countable.filter((a) => a.health === "green").length,
    orange: countable.filter((a) => a.health === "orange").length,
    red: countable.filter((a) => a.health === "red").length,
  };
  const uptimeWeight = countable.length
    ? countable.reduce((s, a) => s + (a.health === "green" ? 1 : a.health === "orange" ? 0.5 : 0), 0) / countable.length
    : 1;

  const topOpportunity = opportunities[0];
  const moreOpportunities = opportunities.slice(1, 3);
  const firstName = company.name.split(" ")[0];

  const attentionCount = healthCounts.orange + healthCounts.red;
  const briefItems: MorningBriefItem[] = [];
  if (attentionCount > 0) {
    briefItems.push({
      tone: "danger",
      text: `${attentionCount} automatisation${attentionCount > 1 ? "s nécessitent" : " nécessite"} votre attention`,
      href: "/app/automations",
    });
  }
  if (opportunities.length > 0) {
    briefItems.push({
      tone: "accent",
      text: `${opportunities.length} opportunité${opportunities.length > 1 ? "s" : ""} en attente, potentiel ~${formatHours(
        opportunities.reduce((s, o) => s + o.estimatedHoursPerMonth, 0)
      )}/mois`,
      href: "/app/opportunities",
    });
  }
  if (attentionCount === 0 && activeAutomations.length > 0) {
    briefItems.push({
      tone: "success",
      text: `Vos ${activeAutomations.length} automatisation${activeAutomations.length > 1 ? "s" : ""} fonctionnent normalement`,
      href: "/app/automations",
    });
  }
  if (briefItems.length === 0) {
    briefItems.push({
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

  const briefPriority: MorningBriefPriority | undefined = topOpportunity
    ? {
        title: topOpportunity.title,
        description:
          "Je peux préparer cette automatisation et vous montrer le résultat avant son activation.",
        href: `/app/opportunities/${topOpportunity.id}`,
        isHighImpact: topOpportunity.impactLevel === "high",
      }
    : undefined;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
      <MorningBrief firstName={firstName} items={briefItems} stats={briefStats} priority={briefPriority} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <ScoreGauge score={company.automationScore} size={140} />
            <p className="mt-4 text-sm font-medium">Automation Score</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {company.automationScore >= 70
                ? "Excellent niveau d'automatisation — continuez ainsi."
                : company.automationScore >= 45
                ? "Une bonne base. Encore des opportunités à saisir."
                : "Beaucoup de temps peut encore être récupéré."}
            </p>
          </CardContent>
        </Card>

        {activeAutomations.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Valeur générée ce mois-ci</CardTitle>
              <CardDescription>Estimations basées sur le temps habituellement consacré à ces tâches.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat icon={Clock} label="Heures économisées" value={formatHours(totalHours)} />
                <Stat icon={TrendingUp} label="Valeur estimée" value={formatEur(totalValue)} />
                <Stat icon={Zap} label="Automatisations actives" value={String(activeAutomations.length)} />
                <Stat icon={Sparkles} label="Fonctionnement" value={`${Math.round(uptimeWeight * 1000) / 10} %`} />
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
          <Card className="flex flex-col justify-center bg-accent-soft border-accent/20">
            <CardContent className="pt-6">
              <p className="text-sm font-semibold text-accent">Vous n&apos;avez pas encore d&apos;automatisation active</p>
              <p className="mt-1.5 text-sm text-foreground/80">
                Installez votre première opportunité pour commencer à faire progresser votre score et gagner du temps
                chaque mois.
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
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Recommandations personnalisées</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {moreOpportunities.map((o) => (
              <OpportunityCard key={o.id} opportunity={o} />
            ))}
          </div>
        </div>
      )}

      <PilotziaFeed companyId={company.id} />
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
