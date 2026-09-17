import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { getPlanDefinition, nextPaidPlan } from "@/lib/billing/plans";
import { normalizeUsageReservation, usageAlertLevel } from "@/lib/billing/economics";

function envAtMost(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, fallback) : fallback;
}

function envAtLeast(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.max(parsed, fallback) : fallback;
}

const TRIAL_DAYS = envAtMost("PILOTZIA_TRIAL_DAYS", 14);
const TRIAL_CREDITS = envAtMost("PILOTZIA_TRIAL_CREDITS", 100);
const TRIAL_COST_CAP_EUR = envAtMost("PILOTZIA_TRIAL_COST_CAP_EUR", 3);

// Les réserves peuvent être augmentées par configuration, jamais diminuées sous le
// plancher testé. Une variable d'environnement erronée ne doit pas sous-estimer le coût.
export const AI_USAGE_RESERVE_EUR = {
  fast: envAtLeast("PILOTZIA_AI_FAST_RESERVE_EUR", 0.03),
  smart: envAtLeast("PILOTZIA_AI_SMART_RESERVE_EUR", 0.08),
} as const;

export type UsageKind = "ai_fast" | "ai_smart" | "diagnostic" | "action" | "automation";

interface UsageMetadata {
  reservationId?: string;
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

type DbClient = Prisma.TransactionClient | typeof prisma;

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

async function getUsageStatusWithClient(db: DbClient, companyId: string) {
  const [subscription, trialStartEvent, priorPaidSubscription] = await Promise.all([
    db.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } }),
    db.event.findFirst({ where: { companyId, type: "TRIAL_STARTED" }, orderBy: { createdAt: "asc" } }),
    db.subscription.findFirst({ where: { companyId, plan: { not: "free" } }, select: { id: true } }),
  ]);

  const paid = isPaidSubscription(subscription);
  const hasPaidHistory = Boolean(priorPaidSubscription);
  const subscriptionInactive = !paid && hasPaidHistory;
  const plan = getPlanDefinition(paid ? subscription?.plan : "free");
  const trialStartedAt = trialStartEvent?.createdAt ?? null;
  const trialEndsAt = trialStartedAt ? new Date(trialStartedAt.getTime() + TRIAL_DAYS * 86400000) : null;
  const paidPeriod = paidUsagePeriod(subscription);
  const usageWindowStart = paid ? paidPeriod.startsAt : trialStartedAt;
  const now = new Date();

  const [usageEvents, creditPurchases] = await Promise.all([
    db.event.findMany({
      where: {
        companyId,
        OR: [
          { type: "USAGE_RESERVED" },
          { type: "USAGE_REFUNDED" },
          { type: { startsWith: "USAGE_REFUNDED_" } },
        ],
        ...(usageWindowStart ? { createdAt: { gte: usageWindowStart } } : {}),
      },
      select: { type: true, metadata: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    paid
      ? db.creditPurchase.findMany({
          where: {
            companyId,
            status: "paid",
            createdAt: { lt: paidPeriod.endsAt },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: { credits: true, costBudgetEur: true },
        })
      : Promise.resolve([]),
  ]);

  let creditsUsed = 0;
  let reservedCostEur = 0;
  for (const event of usageEvents) {
    const metadata = parseMetadata(event.metadata);
    const sign = event.type.startsWith("USAGE_REFUNDED") ? -1 : 1;
    creditsUsed += sign * safeNumber(metadata.credits, 0);
    reservedCostEur += sign * safeNumber(metadata.reservedCostEur, 0);
  }
  creditsUsed = Math.max(0, creditsUsed);
  reservedCostEur = Math.max(0, reservedCostEur);

  const addonCredits = creditPurchases.reduce((sum, purchase) => sum + purchase.credits, 0);
  const addonCostCapEur = creditPurchases.reduce((sum, purchase) => sum + purchase.costBudgetEur, 0);
  const baseCreditsLimit = paid ? plan.monthlyCredits : subscriptionInactive ? 0 : TRIAL_CREDITS;
  const baseCostCapEur = paid ? plan.variableCostCapEur : subscriptionInactive ? 0 : TRIAL_COST_CAP_EUR;
  const creditsLimit = baseCreditsLimit + addonCredits;
  const costCapEur = baseCostCapEur + addonCostCapEur;
  const trialActive = !paid && !subscriptionInactive && Boolean(trialEndsAt && trialEndsAt.getTime() > now.getTime());
  const trialExpired = !paid && !subscriptionInactive && Boolean(trialEndsAt && !trialActive);
  const periodEndsAt = paid ? paidPeriod.endsAt : trialEndsAt;
  const daysRemaining = periodEndsAt ? Math.max(0, Math.ceil((periodEndsAt.getTime() - now.getTime()) / 86400000)) : null;
  const alertLevel = usageAlertLevel({ creditsUsed, creditsLimit, reservedCostEur, costCapEur });

  return {
    paid,
    hasPaidHistory,
    subscriptionInactive,
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
  return getUsageStatusWithClient(prisma, companyId);
}

async function lockCompanyUsage(tx: Prisma.TransactionClient, companyId: string) {
  // Verrou transactionnel Postgres partagé par toutes les réservations/remboursements
  // d'une société. Deux requêtes concurrentes ne peuvent plus dépenser le même solde.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`;
}

export async function reserveUsage(input: {
  companyId: string;
  kind: UsageKind;
  credits: number;
  reservedCostEur: number;
}) {
  const normalized = normalizeUsageReservation(input);

  return prisma.$transaction(
    async (tx) => {
      await lockCompanyUsage(tx, input.companyId);

      const [subscription, priorPaidSubscription] = await Promise.all([
        tx.subscription.findFirst({ where: { companyId: input.companyId }, orderBy: { createdAt: "desc" } }),
        tx.subscription.findFirst({ where: { companyId: input.companyId, plan: { not: "free" } }, select: { id: true } }),
      ]);
      const paid = isPaidSubscription(subscription);
      const hasPaidHistory = Boolean(priorPaidSubscription);

      // Un abonnement interrompu/past_due ne doit jamais recréer un essai gratuit.
      if (!paid && hasPaidHistory) {
        const status = await getUsageStatusWithClient(tx, input.companyId);
        return { allowed: false as const, reason: "subscription_inactive" as const, status };
      }

      if (!paid) {
        const trialStart = await tx.event.findFirst({
          where: { companyId: input.companyId, type: "TRIAL_STARTED" },
          orderBy: { createdAt: "asc" },
        });
        if (!trialStart) {
          await tx.event.create({
            data: {
              companyId: input.companyId,
              type: "TRIAL_STARTED",
              metadata: JSON.stringify({ days: TRIAL_DAYS, credits: TRIAL_CREDITS, costCapEur: TRIAL_COST_CAP_EUR }),
            },
          });
        }
      }

      const status = await getUsageStatusWithClient(tx, input.companyId);
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

      const reservation = await tx.event.create({
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
    },
    { timeout: 10_000 }
  );
}

export async function refundUsage(input: {
  companyId: string;
  reservationId: string | null;
  kind: UsageKind;
  credits: number;
  reservedCostEur: number;
}) {
  if (!input.reservationId) return;

  await prisma.$transaction(
    async (tx) => {
      await lockCompanyUsage(tx, input.companyId);
      const reservation = await tx.event.findFirst({
        where: { id: input.reservationId as string, companyId: input.companyId, type: "USAGE_RESERVED" },
        select: { id: true, metadata: true },
      });
      if (!reservation) return;

      const refundType = `USAGE_REFUNDED_${reservation.id}`;
      const existingRefund = await tx.event.findFirst({ where: { companyId: input.companyId, type: refundType }, select: { id: true } });
      if (existingRefund) return;

      // Compatibilité avec les remboursements créés avant l'idempotence par type.
      const legacyRefunds = await tx.event.findMany({
        where: { companyId: input.companyId, type: "USAGE_REFUNDED" },
        select: { metadata: true },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      if (legacyRefunds.some((event) => parseMetadata(event.metadata).reservationId === reservation.id)) return;

      const reserved = parseMetadata(reservation.metadata);
      const normalized = normalizeUsageReservation({
        credits: safeNumber(reserved.credits, input.credits),
        reservedCostEur: safeNumber(reserved.reservedCostEur, input.reservedCostEur),
      });
      await tx.event.create({
        data: {
          companyId: input.companyId,
          type: refundType,
          metadata: JSON.stringify({
            reservationId: reservation.id,
            kind: reserved.kind ?? input.kind,
            credits: normalized.credits,
            reservedCostEur: normalized.reservedCostEur,
          }),
        },
      });
    },
    { timeout: 10_000 }
  );
}
