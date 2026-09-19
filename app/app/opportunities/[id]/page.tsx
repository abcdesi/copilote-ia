import { notFound } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { getDashboardShellAccess, hasCompanyPermission } from "@/lib/companies/access";
import { safeRead } from "@/lib/runtime/safe-read";
import { prisma } from "@/lib/db/client";
import { getTemplateById } from "@/lib/automations/catalog";
import { getIntegrationDefinition } from "@/lib/integrations/registry";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InstallDialog } from "@/components/opportunities/InstallDialog";
import { IMPACT_LABELS, COMPLEXITY_LABELS, formatEur, formatHours } from "@/lib/format";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { isRealExecutionTemplate } from "@/lib/n8n/real-execution-config";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getDashboardShellAccess();
  const companyTools = await safeRead(
    "opportunity-detail.company-tools",
    () =>
      prisma.companyTool.findMany({
        where: { companyId: access.company.id },
        select: { id: true, name: true, detected: true },
      }),
    []
  );
  const company = { ...access.company, tools: companyTools };
  const canConfigure = hasCompanyPermission(access.role, "configure_automations");
  const canManageBilling = hasCompanyPermission(access.role, "manage_billing");

  const [opportunity, entitlements, purchase, copilotProvenance] = await Promise.all([
    safeRead(
      "opportunity-detail.opportunity",
      () =>
        prisma.opportunity.findFirst({
          where: { id, companyId: company.id },
          select: {
            id: true,
            templateId: true,
            title: true,
            description: true,
            category: true,
            impactLevel: true,
            complexity: true,
            estimatedHoursPerMonth: true,
            estimatedValueEur: true,
            priceEur: true,
            status: true,
          },
        }),
      null
    ),
    safeRead(
      "opportunity-detail.entitlements",
      () => getCompanyEntitlements(company.id),
      { plan: "free", paid: false, canExecute: false, canUseFinancialAudit: false, seatLimit: 1 }
    ),
    safeRead(
      "opportunity-detail.purchase",
      () =>
        prisma.purchase.findUnique({
          where: { companyId_opportunityId: { companyId: company.id, opportunityId: id } },
          select: { status: true },
        }),
      null
    ),
    safeRead(
      "opportunity-detail.provenance",
      () =>
        prisma.event.findFirst({
          where: {
            companyId: company.id,
            type: "COPILOT_AUTOMATION_LINKED",
            metadata: { contains: `"opportunityId":"${id}"` },
          },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      null
    ),
  ]);
  if (!opportunity) notFound();

  if (opportunity.status === "detected") {
    await prisma.opportunity
      .update({ where: { id: opportunity.id }, data: { status: "viewed" } })
      .catch((error) => console.error("Opportunity view status unavailable", error));
    await track(EVENTS.AUTOMATION_VIEWED, {
      companyId: company.id,
      metadata: { opportunityId: opportunity.id },
    }).catch((error) => console.error("Opportunity analytics unavailable", error));
  }

  const template = getTemplateById(opportunity.templateId);
  const steps = template?.steps ?? [];
  const relevantTools = template?.relevantTools ?? [];
  const alreadyInstalled = opportunity.status === "installed";
  const installedAutomation = alreadyInstalled
    ? await safeRead(
        "opportunity-detail.installed-automation",
        () =>
          prisma.automation.findFirst({
            where: { companyId: company.id, opportunityId: opportunity.id },
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true },
          }),
        null
      )
    : null;
  const isReal = isRealExecutionTemplate(opportunity.templateId);
  const priceEur = template?.priceEur ?? opportunity.priceEur;
  const purchased = purchase?.status === "paid";

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
        {copilotProvenance && (
          <p className="mt-2 text-xs text-muted-foreground">
            Origine : recommandation du Copilote. La chaîne recommandation → opportunité → automatisation reste tracée avant toute activation.
          </p>
        )}
      </div>

      <div
        className={`rounded-2xl border p-4 text-sm ${
          isReal ? "border-accent/20 bg-accent-soft text-foreground" : "border-border bg-muted text-muted-foreground"
        }`}
      >
        <p className="font-semibold">{isReal ? "⚡ Exécution réelle disponible" : "🧪 Simulation disponible"}</p>
        <p className="mt-1 leading-6">
          {isReal
            ? "Core, Action ou Scale donne accès au moteur d'exécution pour les automatisations achetées. Core permet jusqu'à 2 nouvelles automatisations par mois ; Action et Scale n'ont pas cette limite de quantité liée au plan. Le prix et les permissions sont visibles avant achat."
            : "Cette recommandation sert aujourd'hui à valider la logique et la valeur potentielle. Pilotzia ne la présente pas comme achetable tant que son exécution réelle n'est pas prête."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Potentiel" value={`~${formatHours(opportunity.estimatedHoursPerMonth)}/mois`} />
        <StatBox label="Économie mensuelle estimée" value={`${formatEur(opportunity.estimatedValueEur)}/mois`} />
        <StatBox label="Mise en place" value={COMPLEXITY_LABELS[opportunity.complexity]} small />
        <StatBox label="Prix automatisation" value={isReal ? `${formatEur(priceEur)} HT` : "Non disponible"} small />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Ce que cette automatisation ferait</h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {index + 1}
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
        <div className="max-w-xl">
          <p className="text-sm font-semibold">
            {alreadyInstalled
              ? installedAutomation?.status === "needs_review" ? "Automatisation installée · validation requise" : "Automatisation installée"
              : !isReal
                ? "Validation en simulation"
                : !entitlements.canExecute
                  ? "Abonnement Core, Action ou Scale requis avant achat"
                  : purchased
                    ? "Automatisation payée · prête à installer"
                    : `${formatEur(priceEur)} HT · achat unique`}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {alreadyInstalled
              ? installedAutomation?.status === "needs_review"
                ? "Le workflow est installé mais aucune exécution ne partira avant validation de la configuration."
                : "Pilotzia suit désormais son exécution et sa santé."
              : !isReal
                ? "La logique peut être évaluée sans laisser croire qu'une action réelle est déjà disponible."
                : !entitlements.canExecute
                  ? "Core ouvre déjà le moteur pour les automatisations achetées, avec jusqu'à 2 nouvelles automatisations par mois. Action et Scale retirent cette limite Core. L'automatisation reste un achat séparé."
                  : purchased
                    ? "L'achat est enregistré. Vous pouvez installer le workflow sans repayer ; son usage consommera ensuite les crédits du plan."
                    : "Le Propriétaire valide l'achat. Pilotzia tente d'utiliser le moyen de paiement Stripe déjà enregistré, sans demander de ressaisir la carte sauf exigence bancaire."}
          </p>
        </div>
        {alreadyInstalled ? (
          installedAutomation ? (
            <Button href={`/app/automations/${installedAutomation.id}`} variant="outline">Voir l’automatisation</Button>
          ) : (
            <div className="flex items-center gap-2 font-medium text-success"><CheckCircle2 size={18} /> Installée</div>
          )
        ) : !isReal ? (
          <Button href="/app/copilot" variant="outline">Approfondir avec le copilote</Button>
        ) : !entitlements.canExecute ? (
          <Button href="/app/settings#plans">Choisir un abonnement</Button>
        ) : purchased && canConfigure ? (
          <InstallDialog opportunityId={opportunity.id} title={opportunity.title} priceEur={priceEur} purchased />
        ) : purchased ? (
          <span className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground">Administrateur requis pour installer</span>
        ) : canManageBilling ? (
          <InstallDialog opportunityId={opportunity.id} title={opportunity.title} priceEur={priceEur} purchased={false} />
        ) : (
          <span className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground">
            Achat par le Propriétaire requis · {formatEur(priceEur)} HT
          </span>
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
