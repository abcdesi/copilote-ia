// Déclenchement d'une automatisation réelle + gouvernance, coût et preuve.

import { prisma } from "@/lib/db/client";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import { refundExecutionReservation, reserveAutomationExecution } from "@/lib/billing/execution-usage";
import { buildAutomationExecutionPlan } from "@/lib/automations/execution-plan";
import { automationConfigHash } from "@/lib/automations/governance";
import { recordFirstDigitalProductUse } from "@/lib/billing/automation-purchase-evidence";
import {
  activateWorkflow,
  createWorkflow,
  deactivateWorkflow,
  deleteWorkflow,
  getWorkflow,
  updateWorkflow,
} from "./client";
import { buildContactListWorkflow, webhookPathForCompany, workflowAuthMarker } from "./workflows";

interface TriggerableAutomation {
  id: string;
  companyId: string;
  templateId: string | null;
  n8nWorkflowId?: string | null;
  errorCount: number;
}

interface ExecutionActor {
  userId: string;
  role: string;
  name?: string | null;
  email?: string | null;
}

function actorForRun(actor?: ExecutionActor | null) {
  return actor
    ? {
        actorUserId: actor.userId,
        actorName: actor.name ?? null,
        actorEmail: actor.email ?? null,
        actorRole: actor.role,
      }
    : {
        actorUserId: null,
        actorName: "Pilotzia",
        actorEmail: null,
        actorRole: "system",
      };
}

function isCurrentWorkflow(workflow: { nodes?: unknown[] }) {
  const serialized = JSON.stringify(workflow.nodes ?? []);
  return serialized.includes("/api/automation-engine/prospects/") &&
    serialized.includes("/send") &&
    serialized.includes(workflowAuthMarker());
}

async function ensureCurrentWorkflow(automation: TriggerableAutomation, templateId: string) {
  const definition = buildContactListWorkflow(automation.companyId, templateId);
  let workflowId = automation.n8nWorkflowId ?? null;

  if (!workflowId) {
    const created = await createWorkflow(definition);
    workflowId = created.id;
    await prisma.automation.update({ where: { id: automation.id }, data: { n8nWorkflowId: workflowId } });
    await activateWorkflow(workflowId);
    return workflowId;
  }

  try {
    await updateWorkflow(workflowId, definition);
    const verified = await getWorkflow(workflowId);
    if (isCurrentWorkflow(verified)) {
      if (!verified.active) await activateWorkflow(workflowId);
      return workflowId;
    }
  } catch (error) {
    console.error("n8n workflow in-place upgrade failed; recreating", error);
  }

  try {
    await deactivateWorkflow(workflowId).catch(() => undefined);
    await deleteWorkflow(workflowId).catch(() => undefined);
  } finally {
    const recreated = await createWorkflow(definition);
    workflowId = recreated.id;
    await activateWorkflow(workflowId);
    await prisma.automation.update({ where: { id: automation.id }, data: { n8nWorkflowId: workflowId } });
  }
  return workflowId;
}

export async function triggerAutomation(
  automation: TriggerableAutomation,
  source: "scheduled" | "manual" | "webhook" = "scheduled",
  actor?: ExecutionActor | null
) {
  const fresh = await prisma.automation.findFirst({ where: { id: automation.id, companyId: automation.companyId } });
  if (!fresh || fresh.status !== "active") {
    return { ok: false as const, error: "Cette automatisation n'est pas active.", inactive: true as const };
  }
  if (!fresh.templateId) return { ok: false as const, error: "Template d'automatisation manquant." };

  const templateId = fresh.templateId;
  const plan = await buildAutomationExecutionPlan({ automationId: fresh.id, companyId: fresh.companyId });
  if (!plan) return { ok: false as const, error: "Configuration d'automatisation invalide." };

  const currentHash = automationConfigHash({
    templateId: fresh.templateId,
    messageSubject: plan.subject,
    messageBody: plan.body,
    approvalMode: fresh.approvalMode,
    cadenceDays: plan.cadenceDays,
    maxSendsPerContact: plan.maxSendsPerContact,
    scheduleStartHour: fresh.scheduleStartHour,
    scheduleEndHour: fresh.scheduleEndHour,
    scheduleDays: fresh.scheduleDays,
    replyToEmail: fresh.replyToEmail,
  });
  if (!fresh.approvedConfigHash || fresh.approvedConfigHash !== currentHash) {
    return {
      ok: false as const,
      error: "La configuration doit être validée avant toute exécution.",
      approvalRequired: true as const,
    };
  }
  if (plan.unresolvedVariables.length > 0) {
    return {
      ok: false as const,
      error: `Variables non résolues: ${plan.unresolvedVariables.join(", ")}.`,
      approvalRequired: true as const,
    };
  }
  if (fresh.approvalMode === "always_review" && source !== "manual") {
    return {
      ok: false as const,
      error: "Cette automatisation exige une validation humaine à chaque exécution.",
      approvalRequired: true as const,
    };
  }
  if (source === "manual" && !actor) {
    return { ok: false as const, error: "Auteur de l'exécution manuelle manquant." };
  }

  const runActor = actorForRun(actor);

  if (plan.eligibleContacts.length === 0) {
    const now = new Date();
    const run = await prisma.automationRun.create({
      data: {
        automationId: fresh.id,
        status: "success",
        source,
        itemsProcessed: 0,
        startedAt: now,
        finishedAt: now,
        ...runActor,
        metadata: JSON.stringify({
          templateId,
          skipped: true,
          reason: "no_eligible_contacts",
          messageVersion: fresh.messageVersion,
          configHash: currentHash,
          charged: false,
        }),
      },
    });
    await prisma.automationAuditEvent.create({
      data: {
        automationId: fresh.id,
        ...runActor,
        eventType: "execution_skipped",
        detailsJson: JSON.stringify({ runId: run.id, source, reason: "no_eligible_contacts" }),
      },
    });
    return {
      ok: true as const,
      result: { relancedCount: 0, errorCount: 0, skipped: true, reason: "no_eligible_contacts" },
      noWork: true as const,
    };
  }

  const baseUrl = process.env.N8N_API_URL;
  const triggerSecret = process.env.N8N_CALLBACK_SECRET?.trim();
  if (!baseUrl) return { ok: false as const, error: "N8N_API_URL manquante." };
  if (!triggerSecret) return { ok: false as const, error: "N8N_CALLBACK_SECRET manquant." };

  const entitlements = await getCompanyEntitlements(fresh.companyId);
  if (!entitlements.canExecute) {
    return {
      ok: false as const,
      error: "L'exécution réelle des automatisations achetées nécessite une offre Core, Action ou Scale active.",
      upgradeRequired: true as const,
    };
  }

  const usage = await reserveAutomationExecution(fresh.companyId);
  if (!usage.allowed) {
    return {
      ok: false as const,
      error: "La capacité d'exécution incluse dans votre offre est arrivée à sa limite pour cette période.",
      usageLimited: true as const,
      reason: usage.reason,
    };
  }

  const startedAt = new Date();
  const run = await prisma.automationRun.create({
    data: {
      automationId: fresh.id,
      status: "running",
      source,
      startedAt,
      ...runActor,
      metadata: JSON.stringify({
        templateId,
        eligibleContactsAtStart: plan.eligibleContacts.length,
        messageVersion: fresh.messageVersion,
        configHash: currentHash,
      }),
    },
  });

  try {
    const workflowId = await ensureCurrentWorkflow(
      { ...automation, n8nWorkflowId: fresh.n8nWorkflowId, templateId: fresh.templateId },
      templateId
    );
    const webhookUrl = `${baseUrl.replace(/\/$/, "")}/webhook/${webhookPathForCompany(fresh.companyId, templateId)}`;
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${triggerSecret}`,
      },
      body: JSON.stringify({
        companyId: fresh.companyId,
        automationId: fresh.id,
        runId: run.id,
        templateId,
        workflowId,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`n8n webhook error ${res.status}`);

    const result = await res.json();
    const sentCount = Number(result?.relancedCount ?? result?.processedCount ?? 0);
    const runErrors = Number(result?.errorCount ?? 0);
    const finishedAt = new Date();
    const status = runErrors > 0 ? (sentCount > 0 ? "partial" : "failed") : "success";

    if (sentCount === 0 && runErrors > 0) {
      await refundExecutionReservation(fresh.companyId, "automation", usage);
    }

    await Promise.all([
      applyExecutionOutcome(fresh.id, fresh.errorCount, runErrors, sentCount),
      prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status,
          itemsProcessed: sentCount,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          errorCode: runErrors > 0 ? "PARTIAL_EXECUTION_ERRORS" : null,
          metadata: JSON.stringify({
            templateId,
            errorCount: runErrors,
            plan: entitlements.plan,
            messageVersion: fresh.messageVersion,
            configHash: currentHash,
            charged: !(sentCount === 0 && runErrors > 0),
          }),
          finishedAt,
        },
      }),
      prisma.automationAuditEvent.create({
        data: {
          automationId: fresh.id,
          ...runActor,
          eventType: "execution_finished",
          detailsJson: JSON.stringify({ runId: run.id, source, sentCount, errorCount: runErrors, status }),
        },
      }),
    ]);

    if (sentCount > 0) {
      await recordFirstDigitalProductUse({
        companyId: fresh.companyId,
        opportunityId: fresh.opportunityId,
        automationId: fresh.id,
        runId: run.id,
        source,
        sentCount,
      }).catch((error) => console.error("Unable to record first digital product use", error));

      await track(EVENTS.AUTOMATION_EXECUTED, {
        companyId: fresh.companyId,
        metadata: { automationId: fresh.id, templateId, sentCount, source, plan: entitlements.plan, actorUserId: actor?.userId ?? null },
      });
    }
    if (runErrors > 0) {
      await track(EVENTS.AUTOMATION_EXECUTION_ISSUE, {
        companyId: fresh.companyId,
        metadata: { automationId: fresh.id, templateId, errorCount: runErrors, source },
      });
    }

    return { ok: true as const, result };
  } catch (err) {
    const finishedAt = new Date();
    const message = err instanceof Error ? err.message : String(err);
    await Promise.all([
      refundExecutionReservation(fresh.companyId, "automation", usage),
      applyExecutionOutcome(fresh.id, fresh.errorCount, 1, 0),
      prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          errorCode: "EXECUTION_FAILED",
          metadata: JSON.stringify({ templateId, message: message.slice(0, 300), charged: false }),
          finishedAt,
        },
      }),
      prisma.automationAuditEvent.create({
        data: {
          automationId: fresh.id,
          ...runActor,
          eventType: "execution_failed",
          detailsJson: JSON.stringify({ runId: run.id, source, error: message.slice(0, 300), refunded: true }),
        },
      }),
      track(EVENTS.AUTOMATION_EXECUTION_ISSUE, {
        companyId: fresh.companyId,
        metadata: { automationId: fresh.id, templateId, errorCount: 1, source },
      }),
    ]);
    return { ok: false as const, error: message };
  }
}

export async function applyExecutionOutcome(
  automationId: string,
  previousErrorCount: number,
  newErrors: number,
  sentCount: number
) {
  const current = await prisma.automation.findUnique({ where: { id: automationId }, select: { status: true } });
  if (!current || current.status === "inactive" || current.status === "needs_review") return;

  const errorCount = newErrors > 0 ? previousErrorCount + newErrors : 0;
  const health = errorCount === 0 ? "green" : errorCount <= 2 ? "orange" : "red";
  const status = errorCount >= 3 ? "warning" : "active";

  await prisma.automation.update({
    where: { id: automationId },
    data: {
      lastCheckedAt: new Date(),
      lastModifiedAt: new Date(),
      errorCount,
      health,
      status,
      usageCount: sentCount > 0 ? { increment: 1 } : undefined,
    },
  });
}
