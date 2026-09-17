import assert from "node:assert/strict";
import { CREDIT_PACKS } from "../lib/billing/credit-packs";
import { creditsRequiredForCost, normalizeUsageReservation, usageAlertLevel } from "../lib/billing/economics";
import { PLAN_DEFINITIONS } from "../lib/billing/plans";

assert.equal(creditsRequiredForCost(0), 0);
assert.equal(creditsRequiredForCost(0.01), 1);
assert.equal(creditsRequiredForCost(0.03), 3);
assert.equal(creditsRequiredForCost(0.08), 8);
assert.equal(creditsRequiredForCost(0.5), 50);

assert.deepEqual(normalizeUsageReservation({ credits: 1, reservedCostEur: 0.03 }), {
  credits: 3,
  reservedCostEur: 0.03,
  economicFloorCredits: 3,
});
assert.equal(normalizeUsageReservation({ credits: 15, reservedCostEur: 0.5 }).credits, 50);
assert.equal(normalizeUsageReservation({ credits: 100, reservedCostEur: 0.5 }).credits, 100);

assert.equal(PLAN_DEFINITIONS.starter.priceEur, 79);
assert.equal(PLAN_DEFINITIONS.starter.annualPriceEur, 869);
assert.equal(PLAN_DEFINITIONS.starter.monthlyCredits, 700);
assert.equal(PLAN_DEFINITIONS.starter.variableCostCapEur, 7);
assert.equal(PLAN_DEFINITIONS.pro.priceEur, 179);
assert.equal(PLAN_DEFINITIONS.pro.monthlyCredits, 2000);
assert.equal(PLAN_DEFINITIONS.pro.variableCostCapEur, 20);
assert.equal(PLAN_DEFINITIONS.business.priceEur, 399);
assert.equal(PLAN_DEFINITIONS.business.monthlyCredits, 5000);
assert.equal(PLAN_DEFINITIONS.business.variableCostCapEur, 50);

for (const pack of CREDIT_PACKS) {
  assert.equal(pack.credits * 0.01, pack.costBudgetEur);
  const rawContributionMargin = (pack.priceEur - pack.costBudgetEur) / pack.priceEur;
  assert.ok(rawContributionMargin >= 0.75, `${pack.key} doit conserver au moins 75 % de marge avant frais de paiement et infrastructure.`);
}

assert.equal(usageAlertLevel({ creditsUsed: 79, creditsLimit: 100, reservedCostEur: 0, costCapEur: 1 }), "normal");
assert.equal(usageAlertLevel({ creditsUsed: 80, creditsLimit: 100, reservedCostEur: 0, costCapEur: 1 }), "warning");
assert.equal(usageAlertLevel({ creditsUsed: 10, creditsLimit: 100, reservedCostEur: 0.9, costCapEur: 1 }), "critical");

console.log("Billing economics: OK");
