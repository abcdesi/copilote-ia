import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { identifyStripeSubscriptionPrice, verifyStripeWebhook } from "@/lib/billing/stripe";
import { getCreditPack } from "@/lib/billing/credit-packs";
import { getUsagePeriodForCompany } from "@/lib/billing/usage-policy";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

interface StripeEvent {
  id?: string;
  created?: number;
  type: string;
  data: { object: Record<string, unknown> };
}

const ENTITLED_STATUSES = new Set(["active", "trialing"]);
const MIN_CREDIT_PACK_VALIDITY_DAYS = 30;

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : null;
}

function metadata(object: Record<string, unknown>) {
  const value = object.metadata;
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}


function recurringPriceId(object: Record<string, unknown>) {
  const items = object.items;
  if (!items || typeof items !== "object") return null;
  const data = (items as Record<string, unknown>).data;
  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || !data[0]) return null;
  const price = (data[0] as Record<string, unknown>).price;
  if (!price || typeof price !== "object") return null;
  return stringValue((price as Record<string, unknown>).id);
}

function recurringInterval(object: Record<string, unknown>) {
  const direct = stringValue(object.billing_interval);
  if (direct) return direct;

  const items = object.items;
  if (!items || typeof items !== "object") return null;
  const data = (items as Record<string, unknown>).data;
  if (!Array.isArray(data) || data.length === 0 || typeof data[0] !== "object" || !data[0]) return null;
  const price = (data[0] as Record<string, unknown>).price;
  if (!price || typeof price !== "object") return null;
  const recurring = (price as Record<string, unknown>).recurring;
  if (!recurring || typeof recurring !== "object") return null;
  return stringValue((recurring as Record<string, unknown>).interval);
}

function subscriptionStatus(object: Record<string, unknown>) {
  const objectType = stringValue(object.object);
  if (objectType === "subscription") {
    const raw = stringValue(object.status) ?? "incomplete";
    return raw === "canceled" ? "cancelled" : raw;
  }

  const paymentStatus = stringValue(object.payment_status);
  return paymentStatus === "paid" || paymentStatus === "no_payment_required" ? "active" : "incomplete";
}

async function upsertSubscriptionFromObject(
  object: Record<string, unknown>,
  providerEvent?: { id?: string; createdAt?: Date | null },
  fallback?: { companyId?: string; plan?: string; customerId?: string; billingCycle?: string }
) {
  const meta = metadata(object);
  const companyId = stringValue(meta.companyId) ?? fallback?.companyId ?? null;
  if (!companyId) return;

  const existing = await prisma.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } });
  const priceId = recurringPriceId(object);
  const mappedPrice = identifyStripeSubscriptionPrice(priceId);
  const isSubscriptionObject = stringValue(object.object) === "subscription";
  const fallbackPlan = stringValue(meta.plan) ?? fallback?.plan ?? existing?.plan ?? null;
  const fallbackCycle = stringValue(meta.billingCycle) ?? fallback?.billingCycle ?? null;
  const plan = mappedPrice?.plan ?? fallbackPlan;
  const billingCycle = mappedPrice?.billingCycle ?? fallbackCycle;
  if (!plan) return;

  const customerId = stringValue(object.customer) ?? fallback?.customerId ?? existing?.stripeCustomerId ?? null;
  const stripeSubId = stringValue(object.subscription) ?? stringValue(object.id);
  const status = isSubscriptionObject && priceId && !mappedPrice ? "configuration_error" : subscriptionStatus(object);
  const periodStart = numberValue(object.current_period_start);
  const periodEnd = numberValue(object.current_period_end);
  const interval = mappedPrice
    ? mappedPrice.billingCycle === "annual" ? "year" : "month"
    : recurringInterval(object) ?? (billingCycle === "annual" ? "year" : billingCycle === "monthly" ? "month" : null);
  const previousStatus = existing?.status ?? null;
  const data = {
    plan,
    status,
    stripeCustomerId: customerId,
    stripeSubId,
    currentPeriodStart: periodStart ? new Date(periodStart * 1000) : existing?.currentPeriodStart ?? null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : existing?.currentPeriodEnd ?? null,
    billingInterval: interval ?? existing?.billingInterval ?? null,
    providerEventId: providerEvent?.id ?? existing?.providerEventId ?? null,
    providerEventCreatedAt: providerEvent?.createdAt ?? existing?.providerEventCreatedAt ?? null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;
    const latest = await tx.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } });
    if (
      latest?.providerEventCreatedAt &&
      providerEvent?.createdAt &&
      providerEvent.createdAt.getTime() < latest.providerEventCreatedAt.getTime()
    ) return;
    if (latest?.providerEventId && providerEvent?.id && latest.providerEventId === providerEvent.id) return;
    if (latest) await tx.subscription.update({ where: { id: latest.id }, data });
    else await tx.subscription.create({ data: { companyId, ...data } });
  }, { timeout: 10_000 });

  const wasEntitled = previousStatus ? ENTITLED_STATUSES.has(previousStatus) : false;
  const isEntitled = ENTITLED_STATUSES.has(status);
  if (!wasEntitled && isEntitled) {
    await track(EVENTS.SUBSCRIPTION_STARTED, {
      companyId,
      metadata: { plan, provider: "stripe", billingInterval: data.billingInterval, status, priceId },
    });
  } else if (wasEntitled && !isEntitled) {
    await track(EVENTS.SUBSCRIPTION_CANCELLED, {
      companyId,
      metadata: { plan, provider: "stripe", billingInterval: data.billingInterval, status },
    });
  }
}

async function grantCreditPack(object: Record<string, unknown>) {
  const meta = metadata(object);
  if (stringValue(meta.kind) !== "credit_pack") return false;

  const companyId = stringValue(meta.companyId);
  const packKey = stringValue(meta.packKey);
  const checkoutSessionId = stringValue(object.id);
  const paymentStatus = stringValue(object.payment_status);
  if (!companyId || !packKey || !checkoutSessionId || (paymentStatus && paymentStatus !== "paid")) return true;

  const pack = getCreditPack(packKey);
  if (!pack) return true;

  const period = await getUsagePeriodForCompany(companyId);
  const minimumExpiry = new Date(Date.now() + MIN_CREDIT_PACK_VALIDITY_DAYS * 86400000);
  const expiresAt = period.endsAt.getTime() > minimumExpiry.getTime() ? period.endsAt : minimumExpiry;

  try {
    await prisma.$transaction([
      prisma.creditPurchase.create({
        data: {
          companyId,
          packKey: pack.key,
          credits: pack.credits,
          costBudgetEur: pack.costBudgetEur,
          amountEur: pack.priceEur,
          status: "paid",
          stripeCheckoutSessionId: checkoutSessionId,
          expiresAt,
        },
      }),
      prisma.event.create({
        data: {
          companyId,
          type: "CREDIT_PACK_PURCHASED",
          metadata: JSON.stringify({
            packKey: pack.key,
            credits: pack.credits,
            amountEur: pack.priceEur,
            costBudgetEur: pack.costBudgetEur,
            stripeCheckoutSessionId: checkoutSessionId,
            expiresAt: expiresAt.toISOString(),
            minimumValidityDays: MIN_CREDIT_PACK_VALIDITY_DAYS,
          }),
        },
      }),
    ]);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    if (code !== "P2002") throw error;
  }
  return true;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  if (!verifyStripeWebhook(rawBody, signature)) return NextResponse.json({ error: "Signature invalide." }, { status: 400 });

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Payload Stripe invalide." }, { status: 400 });
  }
  const object = event.data.object;
  const providerEvent = {
    id: typeof event.id === "string" ? event.id : undefined,
    createdAt: typeof event.created === "number" ? new Date(event.created * 1000) : null,
  };

  if (event.type === "checkout.session.completed") {
    const creditPackHandled = await grantCreditPack(object);
    if (!creditPackHandled) {
      const meta = metadata(object);
      const companyId = stringValue(meta.companyId) ?? undefined;
      const plan = stringValue(meta.plan) ?? undefined;
      const billingCycle = stringValue(meta.billingCycle) ?? undefined;
      const customerId = stringValue(object.customer) ?? undefined;
      await upsertSubscriptionFromObject(object, providerEvent, { companyId, plan, customerId, billingCycle });
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await upsertSubscriptionFromObject(object, providerEvent);
  }

  return NextResponse.json({ received: true });
}
