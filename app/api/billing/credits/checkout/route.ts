import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { getCreditPack } from "@/lib/billing/credit-packs";
import { createCreditPackCheckoutSession } from "@/lib/billing/stripe";

const schema = z.object({ pack: z.enum(["credits_500", "credits_2000", "credits_5000"]) });

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const parsed = schema.safeParse(Object.fromEntries((await req.formData()).entries()));
  if (!parsed.success) return NextResponse.json({ error: "Pack de crédits invalide." }, { status: 400 });

  const pack = getCreditPack(parsed.data.pack);
  if (!pack) return NextResponse.json({ error: "Pack de crédits introuvable." }, { status: 404 });

  const company = await prisma.company.findFirst({
    where: { userId: session.user.id },
    include: { subscriptions: { take: 1, orderBy: { createdAt: "desc" } } },
  });
  if (!company || !session.user.email) return NextResponse.json({ error: "Compte incomplet." }, { status: 400 });

  const subscription = company.subscriptions[0];
  const paid = Boolean(subscription && subscription.plan !== "free" && ["active", "trialing"].includes(subscription.status));
  if (!paid) {
    return NextResponse.json({ error: "Les packs de crédits sont réservés aux abonnements actifs." }, { status: 403 });
  }

  const checkout = await createCreditPackCheckoutSession({
    companyId: company.id,
    email: session.user.email,
    packKey: pack.key,
    stripeCustomerId: subscription?.stripeCustomerId,
  });
  return NextResponse.redirect(checkout.url, 303);
}
