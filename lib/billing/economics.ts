export const MAX_VARIABLE_COST_PER_CREDIT_EUR = 0.01;
export const USAGE_WARNING_RATIO = 0.8;
export const USAGE_CRITICAL_RATIO = 0.9;

function safeNonNegative(value: number, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function creditsRequiredForCost(reservedCostEur: number) {
  const cost = safeNonNegative(reservedCostEur);
  if (cost <= 0) return 0;
  return Math.ceil((cost - Number.EPSILON) / MAX_VARIABLE_COST_PER_CREDIT_EUR);
}

export function normalizeUsageReservation(input: { credits: number; reservedCostEur: number }) {
  const reservedCostEur = safeNonNegative(input.reservedCostEur);
  const requestedCredits = Math.ceil(safeNonNegative(input.credits));
  const economicFloorCredits = creditsRequiredForCost(reservedCostEur);
  return {
    credits: Math.max(requestedCredits, economicFloorCredits),
    reservedCostEur,
    economicFloorCredits,
  };
}

export function usageAlertLevel(input: { creditsUsed: number; creditsLimit: number; reservedCostEur: number; costCapEur: number }) {
  const creditRatio = input.creditsLimit > 0 ? input.creditsUsed / input.creditsLimit : 1;
  const costRatio = input.costCapEur > 0 ? input.reservedCostEur / input.costCapEur : 1;
  const ratio = Math.max(creditRatio, costRatio);
  if (ratio >= USAGE_CRITICAL_RATIO) return "critical" as const;
  if (ratio >= USAGE_WARNING_RATIO) return "warning" as const;
  return "normal" as const;
}
