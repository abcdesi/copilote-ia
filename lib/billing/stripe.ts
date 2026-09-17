import { createHmac, timingSafeEqual } from "crypto";
import { getPlanDefinition, type BillingCycle, type PaidPlanKey } from "@/lib/billing/plans";
import { getCreditPack, type CreditPackKey } from "@/lib/billing/credit-packs";

export type PaidPlan = PaidPlanKey;

type StripePrice = {
  id: string;
  active?: boolean;
  currency?: string;
  unit_amount?: number | null;
  recurring?: { interval?: string } | null;
};

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante.");
  return key;
}

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function priceId(plan: PaidPlan, billingCycle: BillingCycle) {
  const baseKey = plan === "starter" ? "STRIPE_PRICE_STARTER" : plan === "pro" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_BUSINESS";
  const key = billingCycle === "annual" ? `${baseKey}_ANNUAL` : baseKey;
  const value = process.env[key];
  if (!value) throw new Error(`${key} manquante.`);
  return value;
}

function creditPackPriceId(packKey: CreditPackKey) {
  const pack = getCreditPack(packKey);
  if (!pack) throw new Error("Pack de crédits inconnu.");
  const value = process.env[pack.stripePriceEnv];
  if (!value) throw new Error(`${pack.stripePriceEnv} manquante.`);
  return value;
}

async function stripeGet<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { authorization: `Bearer ${secretKey()}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Stripe ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

async function stripePost<T>(path: string, body: URLSearchParams): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey()}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Stripe ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.json() as Promise<T>;
}

async function assertStripePrice(input: { priceId: string; expectedEur: number; recurringInterval: "month" | "year" | null }) {
  const price = await stripeGet<StripePrice>(`/prices/${encodeURIComponent(input.priceId)}`);
  const expectedCents = Math.round(input.expectedEur * 100);
  const actualInterval = price.recurring?.interval ?? null;
  const valid =
    price.active !== false &&
    price.currency?.toLowerCase() === "eur" &&
    price.unit_amount === expectedCents &&
    actualInterval === input.recurringInterval;

  if (!valid) {
    throw new Error(
      `Configuration Stripe incohérente pour ${input.priceId}: attendu ${expectedCents} centimes EUR, périodicité ${input.recurringInterval ?? "ponctuelle"}.`
    );
  }
}

export async function createCheckoutSession(input: {
  companyId: string;
  email: string;
  plan: PaidPlan;
  billingCycle: BillingCycle;
  stripeCustomerId?: string | null;
}) {
  const plan = getPlanDefinition(input.plan);
  const selectedPriceId = priceId(input.plan, input.billingCycle);
  await assertStripePrice({
    priceId: selectedPriceId,
    expectedEur: input.billingCycle === "annual" ? plan.annualPriceEur : plan.priceEur,
    recurringInterval: input.billingCycle === "annual" ? "year" : "month",
  });

  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", `${appUrl()}/app/settings?billing=success`);
  body.set("cancel_url", `${appUrl()}/app/settings?billing=cancelled`);
  body.set("line_items[0][price]", selectedPriceId);
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[companyId]", input.companyId);
  body.set("metadata[plan]", input.plan);
  body.set("metadata[billingCycle]", input.billingCycle);
  body.set("subscription_data[metadata][companyId]", input.companyId);
  body.set("subscription_data[metadata][plan]", input.plan);
  body.set("subscription_data[metadata][billingCycle]", input.billingCycle);
  body.set("allow_promotion_codes", "true");
  if (input.stripeCustomerId) body.set("customer", input.stripeCustomerId);
  else body.set("customer_email", input.email);

  return stripePost<{ id: string; url: string }>("/checkout/sessions", body);
}

export async function createCreditPackCheckoutSession(input: {
  companyId: string;
  email: string;
  packKey: CreditPackKey;
  stripeCustomerId?: string | null;
}) {
  const pack = getCreditPack(input.packKey);
  if (!pack) throw new Error("Pack de crédits inconnu.");
  const selectedPriceId = creditPackPriceId(input.packKey);
  await assertStripePrice({ priceId: selectedPriceId, expectedEur: pack.priceEur, recurringInterval: null });

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${appUrl()}/app/settings?credits=success`);
  body.set("cancel_url", `${appUrl()}/app/settings?credits=cancelled`);
  body.set("line_items[0][price]", selectedPriceId);
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[kind]", "credit_pack");
  body.set("metadata[companyId]", input.companyId);
  body.set("metadata[packKey]", pack.key);
  body.set("metadata[credits]", String(pack.credits));
  body.set("metadata[costBudgetEur]", String(pack.costBudgetEur));
  body.set("metadata[amountEur]", String(pack.priceEur));
  if (input.stripeCustomerId) body.set("customer", input.stripeCustomerId);
  else body.set("customer_email", input.email);

  return stripePost<{ id: string; url: string }>("/checkout/sessions", body);
}

export async function createBillingPortalSession(stripeCustomerId: string) {
  const body = new URLSearchParams({ customer: stripeCustomerId, return_url: `${appUrl()}/app/settings` });
  return stripePost<{ url: string }>("/billing_portal/sessions", body);
}

export function verifyStripeWebhook(rawBody: string, signatureHeader: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET manquante.");

  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "utf8");
    return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
  });
}
