import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyStripeWebhook } from "@/lib/billing/stripe";
import { getCreditPack } from "@/lib/billing/credit-packs";
import { getUsagePeriodForCompany } from "@/lib/billing/usage-policy";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

interface StripeEvent {
  type: string;
  data: { object: Record<string, unknown> };
}

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

async function upsertSubscriptionFromObject(
  object: Record<string, unknown>,
  fallback?: { companyId?: string; plan?: string; customerId?: string; billingCycle?: string }
) {
  const meta = metadata(object);
  const companyId = stringValue(meta.companyId) ?? fallback?.companyId ?? null;
  const plan = stringValue(meta.plan) ?? fallback?.plan ?? null;
  const billingCycle = stringValue(meta.billingCycle) ?? fallback?.billingCycle ?? null;
  const customerId = stringValue(object.customer) ?? fallback?.customerId ?? null;
  const stripeSubId = stringValue(object.subscription) ?? stringValue(object.id);
  const status = stringValue(object.status) ?? "active";
  const periodStart = numberValue(object.current_period_start);
  const periodEnd = numberValue(object.current_period_end);
  const interval = recurringInterval(object) ?? (billingCycle === "annual" ? "year" : billingCycle === "monthly" ? "month" : null);
  if (!companyId || !plan) return;

  const existing = await prisma.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } });
  const data = {
    plan,
    status: status === "canceled" || status === "unpaid" ? "cancelled" : "active",
    stripeCustomerId: customerId,
    stripeSubId,
    currentPeriodStart: periodStart ? new Date(periodStart * 1000) : existing?.currentPeriodStart ?? null,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : existing?.currentPeriodEnd ?? null,
    billingInterval: interval ?? existing?.billingInterval ?? null,
  };

  if (existing) await prisma.subscription.update({ where: { id: existing.id }, data });
  else await prisma.subscription.create({ data: { companyId, ...data } });

  await track(data.status === "cancelled" ? EVENTS.SUBSCRIPTION_CANCELLED : EVENTS.SUBSCRIPTION_STARTED, {
    companyId,
    metadata: { plan, provider: "stripe", billingInterval: data.billingInterval },
  });
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

  const existing = await prisma.creditPurchase.findUnique({ where: { stripeCheckoutSessionId: checkoutSessionId } });
  if (existing) return true;

  const period = await getUsagePeriodForCompany(companyId);
  await prisma.creditPurchase.create({
    data: {
      companyId,
      packKey: pack.key,
      credits: pack.credits,
      costBudgetEur: pack.costBudgetEur,
      amountEur: pack.priceEur,
      status: "paid",
      stripeCheckoutSessionId: checkoutSessionId,
      expiresAt: period.endsAt,
    },
  });

  await prisma.event.create({
    data: {
      companyId,
      type: "CREDIT_PACK_PURCHASED",
      metadata: JSON.stringify({
        packKey: pack.key,
        credits: pack.credits,
        amountEur: pack.priceEur,
        costBudgetEur: pack.costBudgetEur,
        stripeCheckoutSessionId: checkoutSessionId,
        expiresAt: period.endsAt.toISOString(),
      }),
    },
  });
  return true;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  if (!verifyStripeWebhook(rawBody, signature)) return NextResponse.json({ error: "Signature invalide." }, { status: 400 });

  const event = JSON.parse(rawBody) as StripeEvent;
  const object = event.data.object;

  if (event.type === "checkout.session.completed") {
    const creditPackHandled = await grantCreditPack(object);
    if (!creditPackHandled) {
      const meta = metadata(object);
      const companyId = stringValue(meta.companyId) ?? undefined;
      const plan = stringValue(meta.plan) ?? undefined;
      const billingCycle = stringValue(meta.billingCycle) ?? undefined;
      const customerId = stringValue(object.customer) ?? undefined;
      await upsertSubscriptionFromObject(object, { companyId, plan, customerId, billingCycle });
    }
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await upsertSubscriptionFromObject(object);
  }

  return NextResponse.json({ received: true });
}
