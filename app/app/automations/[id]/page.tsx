import { notFound } from "next/navigation";
import { getCurrentCompany } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { Badge } from "@/components/ui/Badge";
import { AutomationActions } from "@/components/automations/AutomationActions";
import { FeedbackWidget } from "@/components/automations/FeedbackWidget";
import { ProspectsPanel } from "@/components/automations/ProspectsPanel";
import { RunNowButton } from "@/components/automations/RunNowButton";
import { getRealExecutionConfig } from "@/lib/n8n/real-execution-config";
import { isN8nConfigured, getWorkflowExecutions } from "@/lib/n8n/client";
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

const EXECUTION_STATUS_LABELS: Record<string, string> = {
  success: "Réussie",
  error: "Échouée",
  running: "En cours",
  new: "En cours",
  waiting: "En attente",
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
  // Les automatisations installées avant l'ajout de templateId n'ont pas ce champ
  // renseigné — on retombe sur "relance-prospects" (seule automatisation réelle
  // existante à cette époque) pour rester compatible avec les données existantes.
  const templateId = automation.templateId ?? (automation.n8nWorkflowId ? "relance-prospects" : null);
  const realExecutionConfig = templateId ? getRealExecutionConfig(templateId) : undefined;
  const prospects = realExecutionConfig
    ? await prisma.prospect.findMany({
        where: { companyId: company.id, templateId: templateId!, status: "active" },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const executions =
    automation.n8nWorkflowId && isN8nConfigured()
      ? await getWorkflowExecutions(automation.n8nWorkflowId, 10)
          .then((r) => r.data)
          .catch(() => [])
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[automation.status]}>
              {automation.status !== "inactive" && `${HEALTH_EMOJI[automation.health]} `}
              {AUTOMATION_STATUS_LABELS[automation.status]}
            </Badge>
            {automation.n8nWorkflowId && <Badge tone="accent">⚡ Exécution réelle</Badge>}
          </div>
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

      {automation.n8nWorkflowId && <RunNowButton automationId={automation.id} />}

      {realExecutionConfig && (
        <ProspectsPanel
          automationId={automation.id}
          templateId={templateId!}
          config={realExecutionConfig}
          prospects={prospects}
          messageSubject={automation.messageSubject}
          messageBody={automation.messageBody}
        />
      )}

      {executions.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">Historique des exécutions</h2>
          <p className="mt-1 text-sm text-muted-foreground">Les 10 dernières exécutions réelles de cette automatisation.</p>
          <ul className="mt-3 space-y-2">
            {executions.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-xl bg-muted px-4 py-2.5 text-sm">
                <span>{new Date(e.startedAt).toLocaleString("fr-FR")}</span>
                <Badge tone={e.status === "success" ? "success" : e.status === "error" ? "danger" : "neutral"}>
                  {EXECUTION_STATUS_LABELS[e.status] ?? e.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

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
