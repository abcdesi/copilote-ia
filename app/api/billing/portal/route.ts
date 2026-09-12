import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { createBillingPortalSession } from "@/lib/billing/stripe";

export async function POST(_req: NextRequest) {
  const session = await requireSession();
  const company = await prisma.company.findFirst({
    where: { userId: session.user.id },
    include: { subscriptions: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  const customerId = company?.subscriptions[0]?.stripeCustomerId;
  if (!customerId) return NextResponse.json({ error: "Aucun abonnement Stripe actif." }, { status: 400 });
  const portal = await createBillingPortalSession(customerId);
  return NextResponse.redirect(portal.url, 303);
}
