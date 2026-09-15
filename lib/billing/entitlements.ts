import { prisma } from "@/lib/db/client";
import type { PlanKey } from "@/lib/billing/plans";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export interface CompanyEntitlements {
  plan: PlanKey;
  paid: boolean;
  canExecute: boolean;
  canUseFinancialAudit: boolean;
}

function normalizePlan(plan?: string | null): PlanKey {
  if (plan === "starter" || plan === "pro" || plan === "business") return plan;
  return "free";
}

export async function getCompanyEntitlements(companyId: string): Promise<CompanyEntitlements> {
  const subscription = await prisma.subscription.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: { plan: true, status: true },
  });

  const active = Boolean(subscription && ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status));
  const plan = active ? normalizePlan(subscription?.plan) : "free";

  return {
    plan,
    paid: plan !== "free",
    canExecute: plan === "pro" || plan === "business",
    canUseFinancialAudit: plan === "business",
  };
}
