// Déclenchement d'une automatisation à exécution réelle + mise à jour de sa santé.

import { prisma } from "@/lib/db/client";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import { reserveAutomationExecution } from "@/lib/billing/execution-usage";
import { webhookPathForCompany } from "./workflows";

interface TriggerableAutomation {
  id: string;
  companyId: string;
  templateId: string | null;
  errorCount: number;
}

export async function triggerAutomation(
  automation: TriggerableAutomation,
  source: "scheduled" | "manual" | "webhook" = "scheduled"
) {
  const templateId = automation.templateId ?? "relance-prospects";
  const baseUrl = process.env.N8N_API_URL;
  if (!baseUrl) return { ok: false as const, error: "N8N_API_URL manquante." };

  const entitlements = await getCompanyEntitlements(automation.companyId);
  if (!entitlements.canExecute) {
    return {
      ok: false as const,
      error: "L'exécution réelle des automatisations nécessite une offre Action ou Scale active.",
      upgradeRequired: true as const,
    };
  }

  const usage = await reserveAutomationExecution(automation.companyId);
  if (!usage.allowed) {
    return {
      ok: false as const,
      error: "La capacité d'exécution incluse dans votre offre est arrivée à sa limite pour cette période.",
      usageLimited: true as const,
      reason: usage.reason,
    };
  }

  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/webhook/${webhookPathForCompany(automation.companyId, templateId)}`;
  const startedAt = new Date();
  const run = await prisma.automationRun.create({
    data: { automationId: automation.id, status: "running", source, startedAt },
  });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companyId: automation.companyId, templateId }),
    });
    if (!res.ok) throw new Error(`n8n webhook error ${res.status}`);
    const result = await res.json();
    const sentCount: number = result?.relancedCount ?? result?.processedCount ?? 0;
    const runErrors: number = result?.errorCount ?? 0;
    const finishedAt = new Date();

    await Promise.all([
      applyExecutionOutcome(automation.id, automation.errorCount, runErrors),
      prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: runErrors > 0 ? "failed" : "success",
          itemsProcessed: sentCount,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          errorCode: runErrors > 0 ? "PARTIAL_EXECUTION_ERRORS" : null,
          metadata: JSON.stringify({ templateId, errorCount: runErrors, plan: entitlements.plan }),
          finishedAt,
        },
      }),
    ]);

    if (sentCount > 0) {
      await track(EVENTS.AUTOMATION_EXECUTED, {
        companyId: automation.companyId,
        metadata: { templateId, sentCount, source, plan: entitlements.plan },
      });
    }
    if (runErrors > 0) {
      await track(EVENTS.AUTOMATION_EXECUTION_ISSUE, {
        companyId: automation.companyId,
        metadata: { templateId, errorCount: runErrors, source },
      });
    }

    return { ok: true as const, result };
  } catch (err) {
    const finishedAt = new Date();
    const message = err instanceof Error ? err.message : String(err);
    await Promise.all([
      applyExecutionOutcome(automation.id, automation.errorCount, 1),
      prisma.automationRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          errorCode: "EXECUTION_FAILED",
          metadata: JSON.stringify({ templateId }),
          finishedAt,
        },
      }),
      track(EVENTS.AUTOMATION_EXECUTION_ISSUE, {
        companyId: automation.companyId,
        metadata: { templateId, errorCount: 1, source },
      }),
    ]);
    return { ok: false as const, error: message };
  }
}

export async function applyExecutionOutcome(automationId: string, previousErrorCount: number, newErrors: number) {
  const current = await prisma.automation.findUnique({ where: { id: automationId }, select: { status: true } });
  if (current?.status === "inactive") return;

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
      usageCount: newErrors === 0 ? { increment: 1 } : undefined,
    },
  });
}
