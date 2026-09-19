import { createHmac, timingSafeEqual } from "crypto";
import { getPlanDefinition, type BillingCycle, type PaidPlanKey } from "@/lib/billing/plans";
import { getCreditPack, type CreditPackKey } from "@/lib/billing/credit-packs";

export type PaidPlan = PaidPlanKey;

export function identifyStripeSubscriptionPrice(priceIdValue?: string | null): { plan: PaidPlanKey; billingCycle: BillingCycle } | null {
  if (!priceIdValue) return null;
  const configured: Array<{ env: string; plan: PaidPlanKey; billingCycle: BillingCycle }> = [
    { env: "STRIPE_PRICE_STARTER", plan: "starter", billingCycle: "monthly" },
    { env: "STRIPE_PRICE_STARTER_ANNUAL", plan: "starter", billingCycle: "annual" },
    { env: "STRIPE_PRICE_PRO", plan: "pro", billingCycle: "monthly" },
    { env: "STRIPE_PRICE_PRO_ANNUAL", plan: "pro", billingCycle: "annual" },
    { env: "STRIPE_PRICE_BUSINESS", plan: "business", billingCycle: "monthly" },
    { env: "STRIPE_PRICE_BUSINESS_ANNUAL", plan: "business", billingCycle: "annual" },
  ];
  const match = configured.find((entry) => process.env[entry.env]?.trim() === priceIdValue);
  return match ? { plan: match.plan, billingCycle: match.billingCycle } : null;
}

type StripePrice = {
  id: string;
  active?: boolean;
  currency?: string;
  unit_amount?: number | null;
  recurring?: { interval?: string } | null;
};

type StripeInvoice = {
  id: string;
  status?: string | null;
  paid?: boolean;
  hosted_invoice_url?: string | null;
  amount_due?: number;
};

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante.");
  return key;
}

function appUrl() {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL manquante en production.");
  return "http://localhost:3000";
}

function priceId(plan: PaidPlan, billingCycle: BillingCycle) {
  const baseKey = plan === "starter" ? "STRIPE_PRICE_STARTER" : plan === "pro" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_BUSINESS";
  const key = billingCycle === "annual" ? `${baseKey}_ANNUAL` : baseKey;
  return process.env[key]?.trim() || null;
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

async function stripePost<T>(
  path: string,
  body: URLSearchParams,
  options?: { idempotencyKey?: string }
): Promise<T> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${secretKey()}`,
    "content-type": "application/x-www-form-urlencoded",
  };
  if (options?.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers,
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
  const amountEur = input.billingCycle === "annual" ? plan.annualPriceEur : plan.priceEur;
  const interval = input.billingCycle === "annual" ? "year" : "month";

  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", `${appUrl()}/app/settings?billing=success`);
  body.set("cancel_url", `${appUrl()}/app/settings?billing=cancelled`);
  body.set("line_items[0][quantity]", "1");

  if (selectedPriceId) {
    await assertStripePrice({
      priceId: selectedPriceId,
      expectedEur: amountEur,
      recurringInterval: interval,
    });
    body.set("line_items[0][price]", selectedPriceId);
  } else {
    body.set("line_items[0][price_data][currency]", "eur");
    body.set("line_items[0][price_data][unit_amount]", String(Math.round(amountEur * 100)));
    body.set("line_items[0][price_data][tax_behavior]", "exclusive");
    body.set("line_items[0][price_data][recurring][interval]", interval);
    body.set("line_items[0][price_data][product_data][name]", `Pilotzia ${plan.label}`);
  }
  body.set("metadata[companyId]", input.companyId);
  body.set("metadata[plan]", input.plan);
  body.set("metadata[billingCycle]", input.billingCycle);
  body.set("subscription_data[metadata][companyId]", input.companyId);
  body.set("subscription_data[metadata][plan]", input.plan);
  body.set("subscription_data[metadata][billingCycle]", input.billingCycle);
  // Les promotions génériques restent désactivées : un coupon Stripe non borné
  // pourrait passer sous le plancher de marge validé. Les offres commerciales doivent
  // être modélisées explicitement et testées dans le moteur économique Pilotzia.
  body.set("billing_address_collection", "required");
  body.set("tax_id_collection[enabled]", "true");
  if (process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true") {
    body.set("automatic_tax[enabled]", "true");
  }
  if (input.stripeCustomerId) {
    body.set("customer", input.stripeCustomerId);
    body.set("customer_update[address]", "auto");
    body.set("customer_update[name]", "auto");
  } else {
    body.set("customer_email", input.email);
  }

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
  body.set("billing_address_collection", "required");
  body.set("tax_id_collection[enabled]", "true");
  if (process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true") {
    body.set("automatic_tax[enabled]", "true");
  }
  if (input.stripeCustomerId) body.set("customer", input.stripeCustomerId);
  else body.set("customer_email", input.email);

  return stripePost<{ id: string; url: string }>("/checkout/sessions", body);
}

export async function createAutomationInvoicePurchase(input: {
  purchaseId: string;
  companyId: string;
  opportunityId: string;
  templateId: string;
  title: string;
  amountEur: number;
  stripeCustomerId: string;
  billingAttempt: number;
  termsVersion: string;
  termsAcceptedAt: Date;
}) {
  const invoiceBody = new URLSearchParams();
  invoiceBody.set("customer", input.stripeCustomerId);
  invoiceBody.set("collection_method", "charge_automatically");
  invoiceBody.set("auto_advance", "false");
  invoiceBody.set("description", `Pilotzia — automatisation : ${input.title}`);
  invoiceBody.set("metadata[kind]", "automation_purchase");
  invoiceBody.set("metadata[purchaseId]", input.purchaseId);
  invoiceBody.set("metadata[companyId]", input.companyId);
  invoiceBody.set("metadata[opportunityId]", input.opportunityId);
  invoiceBody.set("metadata[templateId]", input.templateId);
  invoiceBody.set("metadata[amountEur]", String(input.amountEur));
  invoiceBody.set("metadata[productKind]", "b2b_digital_automation");
  invoiceBody.set("metadata[termsVersion]", input.termsVersion);
  invoiceBody.set("metadata[termsAcceptedAt]", input.termsAcceptedAt.toISOString());
  invoiceBody.set("metadata[immediateFulfillmentRequested]", "true");
  if (process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true") {
    invoiceBody.set("automatic_tax[enabled]", "true");
  }

  const invoice = await stripePost<StripeInvoice>("/invoices", invoiceBody, {
    idempotencyKey: `pilotzia-automation-invoice-${input.purchaseId}-a${input.billingAttempt}`,
  });

  const itemBody = new URLSearchParams();
  itemBody.set("customer", input.stripeCustomerId);
  itemBody.set("invoice", invoice.id);
  itemBody.set("amount", String(Math.round(input.amountEur * 100)));
  itemBody.set("currency", "eur");
  itemBody.set("description", `Automatisation Pilotzia — ${input.title}`);
  itemBody.set("metadata[kind]", "automation_purchase");
  itemBody.set("metadata[purchaseId]", input.purchaseId);
  itemBody.set("metadata[opportunityId]", input.opportunityId);
  itemBody.set("metadata[termsVersion]", input.termsVersion);
  itemBody.set("metadata[termsAcceptedAt]", input.termsAcceptedAt.toISOString());
  await stripePost("/invoiceitems", itemBody, {
    idempotencyKey: `pilotzia-automation-item-${input.purchaseId}-a${input.billingAttempt}`,
  });

  const finalized = await stripePost<StripeInvoice>(
    `/invoices/${encodeURIComponent(invoice.id)}/finalize`,
    new URLSearchParams({ auto_advance: "false" }),
    { idempotencyKey: `pilotzia-automation-finalize-${input.purchaseId}-a${input.billingAttempt}` }
  );

  let latest = finalized;
  let paymentError: string | null = null;
  if (latest.status !== "paid" && latest.paid !== true) {
    try {
      latest = await stripePost<StripeInvoice>(
        `/invoices/${encodeURIComponent(invoice.id)}/pay`,
        new URLSearchParams(),
        { idempotencyKey: `pilotzia-automation-pay-${input.purchaseId}-a${input.billingAttempt}` }
      );
    } catch (error) {
      paymentError = error instanceof Error ? error.message.slice(0, 400) : "Paiement à confirmer.";
      latest = await stripeGet<StripeInvoice>(`/invoices/${encodeURIComponent(invoice.id)}`);
    }
  }

  return {
    invoiceId: latest.id,
    status: latest.status ?? "open",
    paid: latest.status === "paid" || latest.paid === true,
    hostedInvoiceUrl: latest.hosted_invoice_url ?? null,
    amountDueCents: latest.amount_due ?? Math.round(input.amountEur * 100),
    paymentError,
  };
}

export async function createBillingPortalSession(stripeCustomerId: string) {
  const body = new URLSearchParams({ customer: stripeCustomerId, return_url: `${appUrl()}/app/settings` });
  return stripePost<{ url: string }>("/billing_portal/sessions", body);
}

export function verifyStripeWebhook(rawBody: string, signatureHeader: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;

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
