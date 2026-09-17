import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { createBillingPortalSession } from "@/lib/billing/stripe";

export async function POST(_req: NextRequest) {
  try {
    const access = await requireCompanyPermission("manage_billing");
    const subscription = await prisma.subscription.findFirst({
      where: { companyId: access.company.id },
      orderBy: { createdAt: "desc" },
    });
    const customerId = subscription?.stripeCustomerId;
    if (!customerId) return NextResponse.json({ error: "Aucun compte Stripe associé." }, { status: 400 });
    const portal = await createBillingPortalSession(customerId);
    return NextResponse.redirect(portal.url, 303);
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.json({ error: "Seul le propriétaire peut accéder à la facturation." }, { status: 403 });
    }
    throw error;
  }
}
