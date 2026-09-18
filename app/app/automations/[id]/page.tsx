import { notFound } from "next/navigation";
import {
  canApproveRisk,
  getCurrentCompanyAccess,
  hasCompanyPermission,
} from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { Badge } from "@/components/ui/Badge";
import { AutomationActions } from "@/components/automations/AutomationActions";
import { AutomationGovernancePanel } from "@/components/automations/AutomationGovernancePanel";
import { FeedbackWidget } from "@/components/automations/FeedbackWidget";
import { ProspectsPanel } from "@/components/automations/ProspectsPanel";
import { RunNowButton } from "@/components/automations/RunNowButton";
import { getRealExecutionConfig } from "@/lib/n8n/real-execution-config";
import { buildAutomationExecutionPlan } from "@/lib/automations/execution-plan";
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
  needs_review: "warning",
};

const EXECUTION_STATUS_LABELS: Record<string, string> = {
  success: "Réussie",
  partial: "Partielle",
  failed: "Échouée",
  running: "En cours",
};

const AUDIT_LABELS: Record<string, string> = {
  configuration_approved: "Configuration validée",
  governance_changed: "Règles d'autonomie modifiées",
  message_changed: "Message modifié",
  automation_reactivated: "Automatisation réactivée",
  automation_deactivated: "Automatisation désactivée",
  reactivation_blocked: "Réactivation bloquée",
  execution_finished: "Exécution terminée",
  execution_failed: "Exécution échouée",
  contact_added: "Contact ajouté",
  contact_updated: "Contact modifié",
  contact_excluded: "Contact exclu",
  contact_reactivated: "Contact réactivé",
  contacts_imported: "Contacts importés",
};

export default async function AutomationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getCurrentCompanyAccess();
  const company = access.company;

  const automation = await prisma.automation.findFirst({
    where: { id, companyId: company.id },
    include: {
      feedback: { orderBy: { createdAt: "desc" }, take: 5 },
      runs: { orderBy: { startedAt: "desc" }, take: 10 },
      auditEvents: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!automation) notFound();

  const tools = JSON.parse(automation.toolsUsed) as string[];
  const templateId = automation.templateId ?? (automation.n8nWorkflowId ? "relance-prospects" : null);
  const realExecutionConfig = templateId ? getRealExecutionConfig(templateId) : undefined;
  const plan = realExecutionConfig
    ? await buildAutomationExecutionPlan({ automationId: automation.id, companyId: company.id, includeIneligible: true })
    : null;

  const canConfigure = hasCompanyPermission(access.role, "configure_automations");
  const canManageContacts = hasCompanyPermission(access.role, "manage_contacts");
  const canOperate = hasCompanyPermission(access.role, "operate_automations");
  const canRun = canOperate && canApproveRisk(access.role, automation.riskLevel);
  const canApproveConfiguration = canConfigure && canApproveRisk(access.role, automation.riskLevel);
  const previewContact = plan?.contacts.find((contact) => contact.eligible) ?? plan?.contacts[0] ?? null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[automation.status] ?? "neutral"}>
              {automation.status !== "inactive" && `${HEALTH_EMOJI[automation.health] ?? ""} `}
              {AUTOMATION_STATUS_LABELS[automation.status] ?? automation.status}
            </Badge>
            <Badge tone={automation.n8nWorkflowId ? "accent" : "neutral"}>
              {automation.n8nWorkflowId ? "⚡ Exécution réelle" : "🧪 Version simulée"}
            </Badge>
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{automation.name}</h1>
          <p className="mt-1 text-muted-foreground">{automation.businessGoal}</p>
        </div>
        <AutomationActions
          automationId={automation.id}
          status={automation.status}
          canToggle={canConfigure}
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

      {tools.length > 0 && <p className="text-sm font-medium text-muted-foreground">{tools.join(" → ")}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoBox label="Valeur estimée" value={`~${formatHours(automation.estimatedHoursPerMonth)}/mois`} />
        <InfoBox label="Valeur en €" value={formatEur(automation.estimatedValueEur)} />
        <InfoBox label="Installée le" value={automation.installedAt.toLocaleDateString("fr-FR")} />
        <InfoBox label="Dernière vérification" value={relativeTime(automation.lastCheckedAt)} />
      </div>

      {realExecutionConfig && plan && (
        <AutomationGovernancePanel
          automationId={automation.id}
          approvalMode={automation.approvalMode}
          cadenceDays={plan.cadenceDays}
          maxSendsPerContact={plan.maxSendsPerContact}
          replyToEmail={automation.replyToEmail}
          riskLevel={automation.riskLevel}
          approved={Boolean(automation.approvedConfigHash)}
          lastApprovedAt={automation.lastApprovedAt}
          messageVersion={automation.messageVersion}
          eligibleCount={plan.eligibleContacts.length}
          blockedCount={plan.blockedContacts.length}
          allowedApprovalModes={realExecutionConfig.allowedApprovalModes}
          canConfigure={canConfigure}
          canApprove={canApproveConfiguration}
          unresolvedVariables={plan.unresolvedVariables}
          preview={
            previewContact
              ? {
                  name: previewContact.name,
                  email: previewContact.email,
                  subject: previewContact.renderedSubject,
                  body: previewContact.renderedBody,
                }
              : null
          }
        />
      )}

      {automation.n8nWorkflowId ? (
        <RunNowButton automationId={automation.id} canRun={canRun} />
      ) : (
        <div className="rounded-2xl border border-border bg-muted p-6 text-sm text-muted-foreground">
          🧪 Cette automatisation est une version simulée : elle illustre le fonctionnement du copilote mais
          n'exécute pas encore d'actions réelles sur vos outils.
        </div>
      )}

      {realExecutionConfig && plan && (
        <ProspectsPanel
          automationId={automation.id}
          templateId={templateId!}
          config={realExecutionConfig}
          prospects={plan.contacts}
          messageSubject={automation.messageSubject}
          messageBody={automation.messageBody}
          cadenceDays={plan.cadenceDays}
          maxSendsPerContact={plan.maxSendsPerContact}
          canManageContacts={canManageContacts}
          canConfigureMessage={canConfigure}
        />
      )}

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Exécutions Pilotzia</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Preuve d'exécution : source, auteur, rôle, heure et résultat restent associés à chaque passage.
        </p>
        {automation.runs.length ? (
          <ul className="mt-4 space-y-2">
            {automation.runs.map((run) => (
              <li key={run.id} className="rounded-xl bg-muted px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(run.startedAt)}
                  </span>
                  <Badge tone={run.status === "success" ? "success" : run.status === "partial" ? "warning" : run.status === "failed" ? "danger" : "neutral"}>
                    {EXECUTION_STATUS_LABELS[run.status] ?? run.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Source : {run.source} · Auteur : {run.actorName || run.actorEmail || "Pilotzia"} · rôle : {run.actorRole || "system"} · {run.itemsProcessed} élément{run.itemsProcessed > 1 ? "s" : ""} traité{run.itemsProcessed > 1 ? "s" : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Aucune exécution réelle enregistrée.</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Journal d'audit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les changements sensibles restent attribués à la personne et au rôle détenu au moment de l'action.
        </p>
        {automation.auditEvents.length ? (
          <ul className="mt-4 divide-y divide-border">
            {automation.auditEvents.map((event) => (
              <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{AUDIT_LABELS[event.eventType] ?? event.eventType}</p>
                  <time className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(event.createdAt)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.actorName || event.actorEmail || "Pilotzia"} · {event.actorRole || "system"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Aucun changement sensible enregistré.</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-semibold">Historique synthétique</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Installée le {automation.installedAt.toLocaleDateString("fr-FR")}</li>
          <li>• Dernière modification : {relativeTime(automation.lastModifiedAt)}</li>
          <li>
            • Utilisation : {automation.usageCount} exécution{automation.usageCount > 1 ? "s" : ""}
            {automation.errorCount > 0 && `, ${automation.errorCount} erreur${automation.errorCount > 1 ? "s" : ""}`}
          </li>
          {automation.feedback.map((feedback) => (
            <li key={feedback.id}>
              • Retour utilisateur : {feedback.sentiment}
              {feedback.timeSavedPerWeek ? ` — ~${feedback.timeSavedPerWeek}h/semaine estimées` : ""} ({relativeTime(feedback.createdAt)})
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <FeedbackWidget automationId={automation.id} />
      </section>
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
