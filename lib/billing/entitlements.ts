import { prisma } from "@/lib/db/client";
import { getPlanDefinition, type PlanKey } from "@/lib/billing/plans";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export interface CompanyEntitlements {
  plan: PlanKey;
  paid: boolean;
  canExecute: boolean;
  canUseFinancialAudit: boolean;
  seatLimit: number;
}

function normalizePlan(plan?: string | null): PlanKey {
  if (plan === "starter" || plan === "pro" || plan === "business") return plan;
  return "free";
}

export async function getCompanyEntitlements(companyId: string): Promise<CompanyEntitlements> {
  const [subscription, company] = await Promise.all([
    prisma.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: { plan: true, status: true },
    }),
    prisma.company.findUnique({ where: { id: companyId }, select: { additionalSeats: true } }),
  ]);

  const active = Boolean(subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status));
  const plan = active ? normalizePlan(subscription?.plan) : "free";
  const definition = getPlanDefinition(plan);

  return {
    plan,
    paid: plan !== "free",
    canExecute: plan !== "free",
    canUseFinancialAudit: plan === "business",
    seatLimit: definition.includedSeats + (plan === "business" ? Math.max(0, company?.additionalSeats ?? 0) : 0),
  };
}
