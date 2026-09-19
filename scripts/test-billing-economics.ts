import assert from "node:assert/strict";
import { CREDIT_PACKS } from "../lib/billing/credit-packs";
import { creditsRequiredForCost, normalizeUsageReservation, usageAlertLevel } from "../lib/billing/economics";
import { PLAN_DEFINITIONS } from "../lib/billing/plans";
import { identifyStripeSubscriptionPrice } from "../lib/billing/stripe";
import {
  AUTOMATION_PURCHASE_FINANCIAL_COMMITTED_STATUSES,
  AUTOMATION_PURCHASE_QUANTITY_COMMITTED_STATUSES,
  evaluateAutomationPurchaseQuantity,
} from "../lib/billing/automation-purchase-policy";
import { AUTOMATION_CATALOG } from "../lib/automations/catalog";

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
assert.equal(PLAN_DEFINITIONS.starter.monthlyAutomationPurchaseLimit, 2);
assert.equal(PLAN_DEFINITIONS.pro.priceEur, 179);
assert.equal(PLAN_DEFINITIONS.pro.monthlyCredits, 2000);
assert.equal(PLAN_DEFINITIONS.pro.variableCostCapEur, 20);
assert.equal(PLAN_DEFINITIONS.pro.monthlyAutomationPurchaseLimit, null);
assert.equal(PLAN_DEFINITIONS.business.priceEur, 399);
assert.equal(PLAN_DEFINITIONS.business.monthlyCredits, 5000);
assert.equal(PLAN_DEFINITIONS.business.variableCostCapEur, 50);
assert.equal(PLAN_DEFINITIONS.business.monthlyAutomationPurchaseLimit, null);

assert.deepEqual(evaluateAutomationPurchaseQuantity({ plan: "starter", committedCount: 0 }), {
  limit: 2,
  committedCount: 0,
  reached: false,
  remaining: 2,
});
assert.equal(evaluateAutomationPurchaseQuantity({ plan: "starter", committedCount: 1 }).remaining, 1);
assert.equal(evaluateAutomationPurchaseQuantity({ plan: "starter", committedCount: 2 }).reached, true);
assert.equal(evaluateAutomationPurchaseQuantity({ plan: "pro", committedCount: 20 }).reached, false);
assert.equal(evaluateAutomationPurchaseQuantity({ plan: "business", committedCount: 20 }).remaining, null);
assert.equal(AUTOMATION_PURCHASE_FINANCIAL_COMMITTED_STATUSES.includes("payment_failed"), true);
assert.equal(
  (AUTOMATION_PURCHASE_QUANTITY_COMMITTED_STATUSES as readonly string[]).includes("payment_failed"),
  false,
  "Un paiement échoué ne doit pas consommer une place Core tant qu'il n'est pas relancé avec une place disponible."
);

const maxAutomationPriceEur = Math.max(...AUTOMATION_CATALOG.map((template) => template.priceEur));
assert.ok(
  maxAutomationPriceEur * PLAN_DEFINITIONS.starter.monthlyAutomationPurchaseLimit! <= 250,
  "Le plafond financier par défaut doit permettre à Core d'acheter ses 2 automatisations mensuelles au prix catalogue actuel."
);

for (const pack of CREDIT_PACKS) {
  assert.equal(pack.credits * 0.01, pack.costBudgetEur);
  const rawContributionMargin = (pack.priceEur - pack.costBudgetEur) / pack.priceEur;
  assert.ok(rawContributionMargin >= 0.75, `${pack.key} doit conserver au moins 75 % de marge avant frais de paiement et infrastructure.`);
}

assert.equal(usageAlertLevel({ creditsUsed: 79, creditsLimit: 100, reservedCostEur: 0, costCapEur: 1 }), "normal");
assert.equal(usageAlertLevel({ creditsUsed: 80, creditsLimit: 100, reservedCostEur: 0, costCapEur: 1 }), "warning");
assert.equal(usageAlertLevel({ creditsUsed: 10, creditsLimit: 100, reservedCostEur: 0.9, costCapEur: 1 }), "critical");

process.env.STRIPE_PRICE_STARTER = "price_core_monthly_test";
process.env.STRIPE_PRICE_STARTER_ANNUAL = "price_core_annual_test";
process.env.STRIPE_PRICE_PRO = "price_action_monthly_test";
process.env.STRIPE_PRICE_PRO_ANNUAL = "price_action_annual_test";
process.env.STRIPE_PRICE_BUSINESS = "price_scale_monthly_test";
process.env.STRIPE_PRICE_BUSINESS_ANNUAL = "price_scale_annual_test";
assert.deepEqual(identifyStripeSubscriptionPrice("price_core_monthly_test"), { plan: "starter", billingCycle: "monthly" });
assert.deepEqual(identifyStripeSubscriptionPrice("price_action_annual_test"), { plan: "pro", billingCycle: "annual" });
assert.deepEqual(identifyStripeSubscriptionPrice("price_scale_monthly_test"), { plan: "business", billingCycle: "monthly" });
assert.equal(identifyStripeSubscriptionPrice("price_unknown"), null);

console.log("Billing economics: OK");
