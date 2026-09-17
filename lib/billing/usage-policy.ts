import { prisma } from "@/lib/db/client";
import { getPlanDefinition, nextPaidPlan } from "@/lib/billing/plans";
import { normalizeUsageReservation, usageAlertLevel } from "@/lib/billing/economics";

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

type SubscriptionWindow = {
  plan: string;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  billingInterval: string | null;
};

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

function currentCalendarMonth(now = new Date()) {
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { startsAt, endsAt };
}

function daysInUtcMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addUtcMonthsClamped(date: Date, months: number) {
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  const day = Math.min(date.getUTCDate(), daysInUtcMonth(year, month));
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds()
    )
  );
}

function anchoredMonthlyWindow(anchor: Date, now = new Date()) {
  let monthOffset = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchor.getUTCMonth());
  let startsAt = addUtcMonthsClamped(anchor, monthOffset);
  if (startsAt.getTime() > now.getTime()) {
    monthOffset -= 1;
    startsAt = addUtcMonthsClamped(anchor, monthOffset);
  }
  return { startsAt, endsAt: addUtcMonthsClamped(anchor, monthOffset + 1) };
}

function isPaidSubscription(subscription: { plan: string; status: string } | null) {
  return Boolean(subscription && subscription.plan !== "free" && ["active", "trialing"].includes(subscription.status));
}

export function paidUsagePeriod(subscription: SubscriptionWindow | null, now = new Date()) {
  if (!subscription?.currentPeriodStart) return currentCalendarMonth(now);

  if (subscription.billingInterval === "month" && subscription.currentPeriodEnd) {
    return { startsAt: subscription.currentPeriodStart, endsAt: subscription.currentPeriodEnd };
  }

  return anchoredMonthlyWindow(subscription.currentPeriodStart, now);
}

export async function getUsagePeriodForCompany(companyId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: {
      plan: true,
      status: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      billingInterval: true,
    },
  });
  return paidUsagePeriod(subscription);
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
  const paidPeriod = paidUsagePeriod(subscription);
  const usageWindowStart = paid ? paidPeriod.startsAt : trialStartedAt;

  const [usageEvents, creditPurchases] = await Promise.all([
    prisma.event.findMany({
      where: {
        companyId,
        type: { in: ["USAGE_RESERVED", "USAGE_REFUNDED"] },
        ...(usageWindowStart ? { createdAt: { gte: usageWindowStart } } : {}),
      },
      select: { type: true, metadata: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    paid
      ? prisma.creditPurchase.findMany({
          where: {
            companyId,
            status: "paid",
            createdAt: { gte: paidPeriod.startsAt, lt: paidPeriod.endsAt },
          },
          select: { credits: true, costBudgetEur: true },
        })
      : Promise.resolve([]),
  ]);

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

  const addonCredits = creditPurchases.reduce((sum, purchase) => sum + purchase.credits, 0);
  const addonCostCapEur = creditPurchases.reduce((sum, purchase) => sum + purchase.costBudgetEur, 0);
  const baseCreditsLimit = paid ? plan.monthlyCredits : safeNumber(TRIAL_CREDITS, 100);
  const baseCostCapEur = paid ? plan.variableCostCapEur : safeNumber(TRIAL_COST_CAP_EUR, 3);
  const creditsLimit = baseCreditsLimit + addonCredits;
  const costCapEur = baseCostCapEur + addonCostCapEur;
  const trialActive = !paid && Boolean(trialEndsAt && trialEndsAt.getTime() > Date.now());
  const trialExpired = !paid && Boolean(trialEndsAt && !trialActive);
  const periodEndsAt = paid ? paidPeriod.endsAt : trialEndsAt;
  const daysRemaining = periodEndsAt ? Math.max(0, Math.ceil((periodEndsAt.getTime() - Date.now()) / 86400000)) : null;
  const alertLevel = usageAlertLevel({ creditsUsed, creditsLimit, reservedCostEur, costCapEur });

  return {
    paid,
    plan: plan.key,
    planLabel: plan.label,
    nextPlan: nextPaidPlan(plan.key),
    periodKind: paid ? ("monthly" as const) : ("trial" as const),
    periodStartsAt: paid ? paidPeriod.startsAt : trialStartedAt,
    periodEndsAt,
    daysRemaining,
    trialStartedAt,
    trialEndsAt,
    trialActive,
    trialExpired,
    creditsUsed,
    baseCreditsLimit,
    addonCredits,
    creditsLimit,
    creditsRemaining: Math.max(0, creditsLimit - creditsUsed),
    reservedCostEur,
    baseCostCapEur,
    addonCostCapEur,
    costCapEur,
    costRemainingEur: Math.max(0, costCapEur - reservedCostEur),
    alertLevel,
  };
}

export async function reserveUsage(input: {
  companyId: string;
  kind: UsageKind;
  credits: number;
  reservedCostEur: number;
}) {
  const normalized = normalizeUsageReservation(input);
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
  if (status.creditsUsed + normalized.credits > status.creditsLimit) {
    return {
      allowed: false as const,
      reason: paid ? ("plan_credits_exhausted" as const) : ("credits_exhausted" as const),
      status,
    };
  }
  if (status.reservedCostEur + normalized.reservedCostEur > status.costCapEur) {
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
        credits: normalized.credits,
        reservedCostEur: normalized.reservedCostEur,
        economicFloorCredits: normalized.economicFloorCredits,
        plan: status.plan,
        periodKind: status.periodKind,
      }),
    },
  });
  return {
    allowed: true as const,
    paid: paid as boolean,
    reservationId: reservation.id,
    creditsReserved: normalized.credits,
    reservedCostEur: normalized.reservedCostEur,
  };
}

export async function refundUsage(input: {
  companyId: string;
  reservationId: string | null;
  kind: UsageKind;
  credits: number;
  reservedCostEur: number;
}) {
  if (!input.reservationId) return;
  const normalized = normalizeUsageReservation(input);
  await prisma.event.create({
    data: {
      companyId: input.companyId,
      type: "USAGE_REFUNDED",
      metadata: JSON.stringify({
        reservationId: input.reservationId,
        kind: input.kind,
        credits: normalized.credits,
        reservedCostEur: normalized.reservedCostEur,
      }),
    },
  });
}
