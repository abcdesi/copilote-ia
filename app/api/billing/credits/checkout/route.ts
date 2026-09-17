import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { getCreditPack } from "@/lib/billing/credit-packs";
import { createCreditPackCheckoutSession } from "@/lib/billing/stripe";

const schema = z.object({ pack: z.enum(["credits_500", "credits_2000", "credits_5000"]) });

export async function POST(req: NextRequest) {
  try {
    const access = await requireCompanyPermission("manage_billing");
    const parsed = schema.safeParse(Object.fromEntries((await req.formData()).entries()));
    if (!parsed.success) return NextResponse.json({ error: "Pack de crédits invalide." }, { status: 400 });

    const pack = getCreditPack(parsed.data.pack);
    if (!pack) return NextResponse.json({ error: "Pack de crédits introuvable." }, { status: 404 });
    if (!access.session.user.email) return NextResponse.json({ error: "Compte incomplet." }, { status: 400 });

    const subscription = await prisma.subscription.findFirst({
      where: { companyId: access.company.id },
      orderBy: { createdAt: "desc" },
    });
    const paid = Boolean(subscription && subscription.plan !== "free" && ["active", "trialing"].includes(subscription.status));
    if (!paid) {
      return NextResponse.json({ error: "Les packs de crédits sont réservés aux abonnements actifs." }, { status: 403 });
    }

    const checkout = await createCreditPackCheckoutSession({
      companyId: access.company.id,
      email: access.session.user.email,
      packKey: pack.key,
      stripeCustomerId: subscription?.stripeCustomerId,
    });
    return NextResponse.redirect(checkout.url, 303);
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.json({ error: "Seul le propriétaire peut acheter des crédits supplémentaires." }, { status: 403 });
    }
    throw error;
  }
}
