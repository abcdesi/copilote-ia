import { prisma } from "@/lib/db/client";
import { getPlanDefinition } from "@/lib/billing/plans";

const TRIAL_DAYS = Number(process.env.PILOTZIA_TRIAL_DAYS || 14);
const TRIAL_CREDITS = Number(process.env.PILOTZIA_TRIAL_CREDITS || 100);
const TRIAL_COST_CAP_EUR = Number(process.env.PILOTZIA_TRIAL_COST_CAP_EUR || 3);

export const AI_USAGE_RESERVE_EUR = {
  fast: Number(process.env.PILOTZIA_AI_FAST_RESERVE_EUR || 0.03),
  smart: Number(process.env.PILOTZIA_AI_SMART_RESERVE_EUR || 0.08),
} as const;

export type UsageKind = "ai_fast" | "ai_smart" | "diagnostic" | "action" | "automation";

interface UsageMetadata {
  kind?: UsageKind;
  credits?: number;
  reservedCostEur?: number;
  plan?: string;
}

function safeNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parseMetadata(value: string | null): UsageMetadata {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as UsageMetadata;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function currentCalendarMonth() {
  const now = new Date();
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { startsAt, endsAt };
}

function isPaidSubscription(subscription: { plan: string; status: string } | null) {
  return Boolean(subscription && subscription.plan !== "free" && ["active", "trialing"].includes(subscription.status));
}

export async function getUsageStatus(companyId: string) {
  const [subscription, trialStartEvent] = await Promise.all([
    prisma.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } }),
    prisma.event.findFirst({ where: { companyId, type: "TRIAL_STARTED" }, orderBy: { createdAt: "asc" } }),
  ]);

  const paid = isPaidSubscription(subscription);
  const plan = getPlanDefinition(paid ? subscription?.plan : "free");
  const trialStartedAt = trialStartEvent?.createdAt ?? null;
  const trialEndsAt = trialStartedAt ? new Date(trialStartedAt.getTime() + safeNumber(TRIAL_DAYS, 14) * 86400000) : null;
  const paidPeriod = currentCalendarMonth();
  const usageWindowStart = paid ? paidPeriod.startsAt : trialStartedAt;

  const usageEvents = await prisma.event.findMany({
    where: {
      companyId,
      type: { in: ["USAGE_RESERVED", "USAGE_REFUNDED"] },
      ...(usageWindowStart ? { createdAt: { gte: usageWindowStart } } : {}),
    },
    select: { type: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  let creditsUsed = 0;
  let reservedCostEur = 0;
  for (const event of usageEvents) {
    const metadata = parseMetadata(event.metadata);
    const sign = event.type === "USAGE_REFUNDED" ? -1 : 1;
    creditsUsed += sign * safeNumber(metadata.credits, 0);
    reservedCostEur += sign * safeNumber(metadata.reservedCostEur, 0);
  }
  creditsUsed = Math.max(0, creditsUsed);
  reservedCostEur = Math.max(0, reservedCostEur);

  const creditsLimit = paid ? plan.monthlyCredits : safeNumber(TRIAL_CREDITS, 100);
  const costCapEur = paid ? plan.variableCostCapEur : safeNumber(TRIAL_COST_CAP_EUR, 3);
  const trialActive = !paid && Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now());
  const trialExpired = !paid && Boolean(trialEndsAt && !trialActive);

  return {
    paid,
    plan: plan.key,
    planLabel: plan.label,
    periodKind: paid ? ("monthly" as const) : ("trial" as const),
    periodStartsAt: paid ? paidPeriod.startsAt : trialStartedAt,
    periodEndsAt: paid ? paidPeriod.endsAt : trialEndsAt,
    trialStartedAt,
    trialEndsAt,
    trialActive,
    trialExpired,
    creditsUsed,
    creditsLimit,
    creditsRemaining: Math.max(0, creditsLimit - creditsUsed),
    reservedCostEur,
    costCapEur,
    costRemainingEur: Math.max(0, costCapEur - reservedCostEur),
  };
}

export async function reserveUsage(input: {
  companyId: string;
  kind: UsageKind;
  credits: number;
  reservedCostEur: number;
}) {
  const subscription = await prisma.subscription.findFirst({
    where: { companyId: input.companyId },
    orderBy: { createdAt: "desc" },
  });
  const paid = isPaidSubscription(subscription);

  if (!paid) {
    let trialStart = await prisma.event.findFirst({
      where: { companyId: input.companyId, type: "TRIAL_STARTED" },
      orderBy: { createdAt: "asc" },
    });
    if (!trialStart) {
      trialStart = await prisma.event.create({
        data: {
          companyId: input.companyId,
          type: "TRIAL_STARTED",
          metadata: JSON.stringify({
            days: safeNumber(TRIAL_DAYS, 14),
            credits: safeNumber(TRIAL_CREDITS, 100),
            costCapEur: safeNumber(TRIAL_COST_CAP_EUR, 3),
          }),
        },
      });
    }
  }

  const status = await getUsageStatus(input.companyId);
  if (!paid && !status.trialActive) return { allowed: false as const, reason: "trial_expired" as const, status };
  if (status.creditsUsed + input.credits > status.creditsLimit) {
    return {
      allowed: false as const,
      reason: paid ? ("plan_credits_exhausted" as const) : ("credits_exhausted" as const),
      status,
    };
  }
  if (status.reservedCostEur + input.reservedCostEur > status.costCapEur) {
    return {
      allowed: false as const,
      reason: paid ? ("plan_cost_cap_reached" as const) : ("cost_cap_reached" as const),
      status,
    };
  }

  const reservation = await prisma.event.create({
    data: {
      companyId: input.companyId,
      type: "USAGE_RESERVED",
      metadata: JSON.stringify({
        kind: input.kind,
        credits: input.credits,
        reservedCostEur: input.reservedCostEur,
        plan: status.plan,
        periodKind: status.periodKind,
      }),
    },
  });
  return { allowed: true as const, paid: paid as boolean, reservationId: reservation.id };
}

export async function refundUsage(input: {
  companyId: string;
  reservationId: string | null;
  kind: UsageKind;
  credits: number;
  reservedCostEur: number;
}) {
  if (!input.reservationId) return;
  await prisma.event.create({
    data: {
      companyId: input.companyId,
      type: "USAGE_REFUNDED",
      metadata: JSON.stringify({
        reservationId: input.reservationId,
        kind: input.kind,
        credits: input.credits,
        reservedCostEur: input.reservedCostEur,
      }),
    },
  });
}
