import { getPlanDefinition, type PlanKey } from "@/lib/billing/plans";

export const AUTOMATION_PURCHASE_FINANCIAL_COMMITTED_STATUSES = [
  "pending",
  "payment_action_required",
  "payment_failed",
  "paid",
] as const;

export const AUTOMATION_PURCHASE_QUANTITY_COMMITTED_STATUSES = [
  "pending",
  "payment_action_required",
  "paid",
] as const;

export function getAutomationPurchaseMonthWindow(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, nextStart };
}

export function getMonthlyAutomationPurchaseLimit(plan: PlanKey) {
  return getPlanDefinition(plan).monthlyAutomationPurchaseLimit;
}

export function evaluateAutomationPurchaseQuantity(input: {
  plan: PlanKey;
  committedCount: number;
}) {
  const limit = getMonthlyAutomationPurchaseLimit(input.plan);
  return {
    limit,
    committedCount: Math.max(0, input.committedCount),
    reached: limit !== null && input.committedCount >= limit,
    remaining: limit === null ? null : Math.max(0, limit - input.committedCount),
  };
}
