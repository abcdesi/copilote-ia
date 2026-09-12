import { createHmac, timingSafeEqual } from "crypto";

export type PaidPlan = "starter" | "pro" | "business";

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquante.");
  return key;
}

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function priceId(plan: PaidPlan) {
  const key = plan === "starter" ? "STRIPE_PRICE_STARTER" : plan === "pro" ? "STRIPE_PRICE_PRO" : "STRIPE_PRICE_BUSINESS";
  const value = process.env[key];
  if (!value) throw new Error(`${key} manquante.`);
  return value;
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

export async function createCheckoutSession(input: {
  companyId: string;
  email: string;
  plan: PaidPlan;
  stripeCustomerId?: string | null;
}) {
  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", `${appUrl()}/app/settings?billing=success`);
  body.set("cancel_url", `${appUrl()}/app/settings?billing=cancelled`);
  body.set("line_items[0][price]", priceId(input.plan));
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[companyId]", input.companyId);
  body.set("metadata[plan]", input.plan);
  body.set("subscription_data[metadata][companyId]", input.companyId);
  body.set("subscription_data[metadata][plan]", input.plan);
  body.set("allow_promotion_codes", "true");
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
