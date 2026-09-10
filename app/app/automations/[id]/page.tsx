import { notFound } from "next/navigation";
import { getCurrentCompany } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { Badge } from "@/components/ui/Badge";
import { AutomationActions } from "@/components/automations/AutomationActions";
import { FeedbackWidget } from "@/components/automations/FeedbackWidget";
import {
  AUTOMATION_STATUS_LABELS,
  HEALTH_EMOJI,
  formatEur,
  formatHours,
  relativeTime,
} from "@/lib/format";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  warning: "warning",
  error: "danger",
  inactive: "neutral",
};

export default async function AutomationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCurrentCompany();

  const automation = await prisma.automation.findFirst({
    where: { id, companyId: company.id },
    include: { feedback: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  if (!automation) notFound();

  const tools = JSON.parse(automation.toolsUsed) as string[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone={STATUS_TONE[automation.status]}>
            {automation.status !== "inactive" && `${HEALTH_EMOJI[automation.health]} `}
            {AUTOMATION_STATUS_LABELS[automation.status]}
          </Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{automation.name}</h1>
          <p className="mt-1 text-muted-foreground">{automation.businessGoal}</p>
        </div>
        <AutomationActions
          automationId={automation.id}
          status={automation.status}
          exportData={{
            name: automation.name,
            businessGoal: automation.businessGoal,
            status: automation.status,
            tools,
            estimatedHoursPerMonth: automation.estimatedHoursPerMonth,
            estimatedValueEur: automation.estimatedValueEur,
            installedAt: automation.installedAt,
          }}
        />
      </div>

      {tools.length > 0 && (
        <p className="text-sm font-medium text-muted-foreground">{tools.join(" → ")}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoBox label="Valeur estimée" value={`~${formatHours(automation.estimatedHoursPerMonth)}/mois`} />
        <InfoBox label="Valeur en €" value={formatEur(automation.estimatedValueEur)} />
        <InfoBox label="Installée le" value={automation.installedAt.toLocaleDateString("fr-FR")} />
        <InfoBox label="Dernière vérification" value={relativeTime(automation.lastCheckedAt)} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Historique</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Installée le {automation.installedAt.toLocaleDateString("fr-FR")}</li>
          <li>• Dernière modification : {relativeTime(automation.lastModifiedAt)}</li>
          <li>
            • Utilisation : {automation.usageCount} exécution{automation.usageCount > 1 ? "s" : ""}
            {automation.errorCount > 0 && `, ${automation.errorCount} erreur${automation.errorCount > 1 ? "s" : ""}`}
          </li>
          {automation.feedback.map((f) => (
            <li key={f.id}>
              • Retour utilisateur : {f.sentiment}
              {f.timeSavedPerWeek ? ` — ~${f.timeSavedPerWeek}h/semaine estimées` : ""} (
              {relativeTime(f.createdAt)})
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <FeedbackWidget automationId={automation.id} />
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
