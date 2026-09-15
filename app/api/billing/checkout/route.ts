import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { createBillingPortalSession, createCheckoutSession } from "@/lib/billing/stripe";

const schema = z.object({ plan: z.enum(["starter", "pro", "business"]) });

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const parsed = schema.safeParse(Object.fromEntries((await req.formData()).entries()));
  if (!parsed.success) return NextResponse.json({ error: "Plan invalide." }, { status: 400 });

  const company = await prisma.company.findFirst({
    where: { userId: session.user.id },
    include: { subscriptions: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  if (!company || !session.user.email) return NextResponse.json({ error: "Compte incomplet." }, { status: 400 });

  const sub = company.subscriptions[0];
  const hasActivePaidSubscription = Boolean(
    sub && sub.plan !== "free" && ["active", "trialing"].includes(sub.status) && sub.stripeCustomerId
  );

  if (hasActivePaidSubscription && sub?.stripeCustomerId) {
    const portal = await createBillingPortalSession(sub.stripeCustomerId);
    return NextResponse.redirect(portal.url, 303);
  }

  const checkout = await createCheckoutSession({
    companyId: company.id,
    email: session.user.email,
    plan: parsed.data.plan,
    stripeCustomerId: sub?.stripeCustomerId,
  });
  return NextResponse.redirect(checkout.url, 303);
}
