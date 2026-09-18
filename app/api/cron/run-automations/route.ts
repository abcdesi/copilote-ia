import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { triggerAutomation } from "@/lib/n8n/execution";
import { runDataRetentionMaintenance } from "@/lib/maintenance/retention";
import {
  automationScheduleState,
  localDateKey,
  MAX_SCHEDULED_RETRIES_PER_LOCAL_DAY,
} from "@/lib/timezone";

const RUN_LOOKBACK_MS = 36 * 60 * 60 * 1000;

function hasValidCronSecret(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const actualBuffer = Buffer.from(auth);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

async function scheduledRunEligibility(input: {
  automationId: string;
  now: Date;
  timeZone: string;
  localDate: string;
}) {
  const recentRuns = await prisma.automationRun.findMany({
    where: {
      automationId: input.automationId,
      source: "scheduled",
      startedAt: { gte: new Date(input.now.getTime() - RUN_LOOKBACK_MS) },
    },
    select: { status: true, startedAt: true },
    orderBy: { startedAt: "desc" },
    take: 12,
  });

  const today = recentRuns.filter((run) => localDateKey(run.startedAt, input.timeZone) === input.localDate);
  if (today.some((run) => run.status === "running" || run.status === "success" || run.status === "partial")) {
    return { allowed: false as const, reason: "already_ran_today" as const, failedAttempts: 0 };
  }

  const failedAttempts = today.filter((run) => run.status === "failed").length;
  if (failedAttempts >= MAX_SCHEDULED_RETRIES_PER_LOCAL_DAY) {
    return { allowed: false as const, reason: "retry_limit_reached" as const, failedAttempts };
  }

  return { allowed: true as const, failedAttempts };
}

export async function GET(req: NextRequest) {
  if (!hasValidCronSecret(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const now = new Date();
  const automations = await prisma.automation.findMany({
    where: {
      n8nWorkflowId: { not: null },
      status: "active",
      approvalMode: "first_then_auto",
      approvedConfigHash: { not: null },
    },
    select: {
      id: true,
      companyId: true,
      templateId: true,
      n8nWorkflowId: true,
      errorCount: true,
      scheduleStartHour: true,
      scheduleEndHour: true,
      scheduleDays: true,
      company: { select: { timezone: true } },
    },
  });

  const results: Array<Record<string, unknown>> = [];
  for (const automation of automations) {
    const schedule = automationScheduleState(now, automation.company.timezone, {
      startHour: automation.scheduleStartHour,
      endHour: automation.scheduleEndHour,
      days: automation.scheduleDays,
    });
    if (!schedule.eligible || !schedule.timeZone || !schedule.dateKey) {
      results.push({
        automationId: automation.id,
        ok: true,
        skipped: true,
        reason: schedule.reason,
        timezone: schedule.timeZone,
      });
      continue;
    }

    const runEligibility = await scheduledRunEligibility({
      automationId: automation.id,
      now,
      timeZone: schedule.timeZone,
      localDate: schedule.dateKey,
    });
    if (!runEligibility.allowed) {
      results.push({
        automationId: automation.id,
        ok: true,
        skipped: true,
        reason: runEligibility.reason,
        localDate: schedule.dateKey,
        timezone: schedule.timeZone,
      });
      continue;
    }

    const outcome = await triggerAutomation(automation, "scheduled");
    results.push({
      automationId: automation.id,
      ok: outcome.ok,
      skipped: "noWork" in outcome && outcome.noWork === true,
      reason: outcome.ok
        ? ("noWork" in outcome && outcome.noWork ? "no_eligible_contacts" : undefined)
        : "execution_blocked_or_failed",
      localDate: schedule.dateKey,
      timezone: schedule.timeZone,
      failedAttemptsBeforeRun: runEligibility.failedAttempts,
    });
  }

  // Le scheduler principal tourne fréquemment pour respecter les fuseaux horaires.
  // La maintenance de rétention reste volontairement quotidienne.
  const retention = now.getUTCHours() === 3
    ? await runDataRetentionMaintenance().catch((error) => {
        console.error("Data retention maintenance failed", error);
        return null;
      })
    : undefined;

  return NextResponse.json({
    ranAt: now.toISOString(),
    evaluated: automations.length,
    triggered: results.filter((item) => !item.skipped).length,
    results,
    retention: retention === undefined ? { skipped: true } : retention ? { ok: true } : { ok: false },
  });
}
