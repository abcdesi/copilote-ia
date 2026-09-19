import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { upsertStripeBusinessWebhookConnection } from "@/lib/integrations/stripe-business";

export async function POST(req: NextRequest) {
  try {
    const access = await requireCompanyPermission("manage_integrations");
    const form = await req.formData();
    const webhookSecret = String(form.get("webhookSecret") || "").trim();
    await upsertStripeBusinessWebhookConnection({
      companyId: access.company.id,
      webhookSecret,
    });

    await prisma.$transaction([
      prisma.companyTool.upsert({
        where: { companyId_name: { companyId: access.company.id, name: "Stripe" } },
        create: { companyId: access.company.id, name: "Stripe", detected: false },
        update: {},
      }),
      prisma.event.create({
        data: {
          userId: access.session.user.id,
          companyId: access.company.id,
          type: "INTEGRATION_CONNECTED",
          metadata: JSON.stringify({ provider: "stripe_business", mode: "invoice_paid_webhook" }),
        },
      }),
    ]);

    return NextResponse.redirect(new URL("/app/tools?stripeBusiness=connected", req.nextUrl.origin), 303);
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.redirect(new URL("/app/tools?stripeBusiness=permission-denied", req.nextUrl.origin), 303);
    }
    console.error("Stripe business webhook configuration failed", error);
    return NextResponse.redirect(new URL("/app/tools?stripeBusiness=config-error", req.nextUrl.origin), 303);
  }
}
