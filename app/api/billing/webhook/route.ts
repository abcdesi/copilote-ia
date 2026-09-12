import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyStripeWebhook } from "@/lib/billing/stripe";
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

async function upsertSubscriptionFromObject(object: Record<string, unknown>, fallback?: { companyId?: string; plan?: string; customerId?: string }) {
  const meta = metadata(object);
  const companyId = stringValue(meta.companyId) ?? fallback?.companyId ?? null;
  const plan = stringValue(meta.plan) ?? fallback?.plan ?? null;
  const customerId = stringValue(object.customer) ?? fallback?.customerId ?? null;
  const stripeSubId = stringValue(object.subscription) ?? stringValue(object.id);
  const status = stringValue(object.status) ?? "active";
  const periodEnd = numberValue(object.current_period_end);
  if (!companyId || !plan) return;

  const existing = await prisma.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } });
  const data = {
    plan,
    status: status === "canceled" || status === "unpaid" ? "cancelled" : "active",
    stripeCustomerId: customerId,
    stripeSubId,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  };

  if (existing) await prisma.subscription.update({ where: { id: existing.id }, data });
  else await prisma.subscription.create({ data: { companyId, ...data } });

  await track(data.status === "cancelled" ? EVENTS.SUBSCRIPTION_CANCELLED : EVENTS.SUBSCRIPTION_STARTED, {
    companyId,
    metadata: { plan, provider: "stripe" },
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  if (!verifyStripeWebhook(rawBody, signature)) return NextResponse.json({ error: "Signature invalide." }, { status: 400 });

  const event = JSON.parse(rawBody) as StripeEvent;
  const object = event.data.object;

  if (event.type === "checkout.session.completed") {
    const meta = metadata(object);
    const companyId = stringValue(meta.companyId) ?? undefined;
    const plan = stringValue(meta.plan) ?? undefined;
    const customerId = stringValue(object.customer) ?? undefined;
    await upsertSubscriptionFromObject(object, { companyId, plan, customerId });
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await upsertSubscriptionFromObject(object);
  }

  return NextResponse.json({ received: true });
}
