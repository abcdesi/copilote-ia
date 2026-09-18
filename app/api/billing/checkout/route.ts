import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { createBillingPortalSession, createCheckoutSession } from "@/lib/billing/stripe";

const schema = z.object({
  plan: z.enum(["starter", "pro", "business"]),
  billingCycle: z.enum(["monthly", "annual"]).default("monthly"),
});

export async function POST(req: NextRequest) {
  try {
    const access = await requireCompanyPermission("manage_billing");
    const parsed = schema.safeParse(Object.fromEntries((await req.formData()).entries()));
    if (!parsed.success) return NextResponse.json({ error: "Plan invalide." }, { status: 400 });
    if (!access.session.user.email) return NextResponse.json({ error: "Compte incomplet." }, { status: 400 });

    const sub = await prisma.subscription.findFirst({
      where: { companyId: access.company.id },
      orderBy: { createdAt: "desc" },
    });
    const hasActivePaidSubscription = Boolean(
      sub && sub.plan !== "free" && ["active", "trialing"].includes(sub.status) && sub.stripeCustomerId
    );

    // Un abonnement existant se modifie dans le portail Stripe afin d'éviter de créer
    // deux abonnements concurrents pour la même entreprise.
    if (hasActivePaidSubscription && sub?.stripeCustomerId) {
      const portal = await createBillingPortalSession(sub.stripeCustomerId);
      return NextResponse.redirect(portal.url, 303);
    }

    const checkout = await createCheckoutSession({
      companyId: access.company.id,
      email: access.session.user.email,
      plan: parsed.data.plan,
      billingCycle: parsed.data.billingCycle,
      stripeCustomerId: sub?.stripeCustomerId,
    });
    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.json({ error: "Seul le propriétaire peut modifier la facturation." }, { status: 403 });
    }
    throw error;
  }
}
