import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { getTemplateById } from "@/lib/automations/catalog";
import { Badge } from "@/components/ui/Badge";
import { InstallDialog } from "@/components/opportunities/InstallDialog";
import { IMPACT_LABELS, COMPLEXITY_LABELS, formatEur, formatHours } from "@/lib/format";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCurrentCompany();

  const opportunity = await prisma.opportunity.findFirst({ where: { id, companyId: company.id } });
  if (!opportunity) notFound();

  if (opportunity.status === "detected") {
    await prisma.opportunity.update({ where: { id: opportunity.id }, data: { status: "viewed" } });
    await track(EVENTS.AUTOMATION_VIEWED, { companyId: company.id, metadata: { opportunityId: opportunity.id } });
  }

  const template = getTemplateById(opportunity.templateId);
  const steps = template?.steps ?? [];
  const alreadyInstalled = opportunity.status === "installed";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{opportunity.category}</Badge>
          <Badge tone={opportunity.impactLevel === "high" ? "success" : "neutral"}>
            {IMPACT_LABELS[opportunity.impactLevel]}
          </Badge>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{opportunity.title}</h1>
        <p className="mt-2 text-muted-foreground">{template?.businessGoal ?? opportunity.description}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Potentiel" value={`~${formatHours(opportunity.estimatedHoursPerMonth)}/mois`} />
        <StatBox label="Valeur estimée" value={formatEur(opportunity.estimatedValueEur)} />
        <StatBox label="Mise en place" value={COMPLEXITY_LABELS[opportunity.complexity]} small />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Ce que cette automatisation va faire</h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {i + 1}
              </span>
              <span className="text-sm pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted-foreground">
          La configuration détaillée, les outils précis et la logique interne sont pris en charge pour vous — vous
          n&apos;avez rien à paramétrer.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Prix</p>
          <p className="text-2xl font-semibold">{formatEur(opportunity.priceEur)}</p>
          <p className="text-xs text-muted-foreground mt-1">Installation, tests et surveillance inclus.</p>
        </div>
        {alreadyInstalled ? (
          <div className="flex items-center gap-2 text-success font-medium">
            <CheckCircle2 size={18} /> Déjà installée
          </div>
        ) : (
          <InstallDialog opportunityId={opportunity.id} title={opportunity.title} priceEur={opportunity.priceEur} />
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={small ? "mt-1 text-sm font-semibold" : "mt-1 text-lg font-semibold"}>{value}</p>
    </div>
  );
}
