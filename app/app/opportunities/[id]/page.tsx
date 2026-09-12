import { notFound } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { getCurrentCompany } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { getTemplateById } from "@/lib/automations/catalog";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { Badge } from "@/components/ui/Badge";
import { InstallDialog } from "@/components/opportunities/InstallDialog";
import { IMPACT_LABELS, COMPLEXITY_LABELS, formatEur, formatHours } from "@/lib/format";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { isRealExecutionTemplate } from "@/lib/n8n/real-execution-config";

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
  const relevantTools = template?.relevantTools ?? [];
  const alreadyInstalled = opportunity.status === "installed";
  const isReal = isRealExecutionTemplate(opportunity.templateId);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
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

      <div
        className={`rounded-2xl border p-4 text-sm ${
          isReal ? "border-accent/20 bg-accent-soft text-foreground" : "border-border bg-muted text-muted-foreground"
        }`}
      >
        <p className="font-semibold">{isReal ? "⚡ Exécution réelle disponible" : "🧪 Simulation disponible"}</p>
        <p className="mt-1 leading-6">
          {isReal
            ? "Cette automatisation peut exécuter de vraies actions après installation. Pilotzia vous montre d'abord ce qui sera fait et les permissions nécessaires."
            : "Cette automatisation permet de valider le fonctionnement et la valeur potentielle sans prétendre agir dans vos applications."}
        </p>
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
              <span className="pt-0.5 text-sm">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Pilotzia prépare la logique technique et vous présente les éléments importants avant activation. Une intégration externe n'est jamais considérée comme connectée tant qu'elle n'a pas réellement été autorisée.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <ShieldCheck size={17} />
          </div>
          <div>
            <h2 className="font-semibold">Contrôle avant activation</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Avant toute action réelle, vérifiez les applications impliquées et leur niveau d'autorisation.
            </p>
          </div>
        </div>

        {relevantTools.length > 0 ? (
          <div className="mt-5 space-y-2">
            {relevantTools.map((toolName) => {
              const integration = getIntegrationDefinition(toolName);
              const declared = company.tools.some((tool) => tool.name === toolName);
              return (
                <div key={toolName} className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{toolName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{integration.permissionLabel}</p>
                  </div>
                  <Badge tone={declared ? "accent" : "neutral"}>{declared ? "Renseigné" : "À ajouter"}</Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Aucune application externe requise pour cette démonstration.</p>
        )}

        {isReal && (
          <div className="mt-4 rounded-xl bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">
            Les actions sensibles restent soumises à confirmation selon les permissions de l'intégration.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Prix</p>
          <p className="text-2xl font-semibold">{formatEur(opportunity.priceEur)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Installation, tests et surveillance inclus.</p>
        </div>
        {alreadyInstalled ? (
          <div className="flex items-center gap-2 font-medium text-success">
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
