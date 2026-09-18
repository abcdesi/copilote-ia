import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireCompanyPermission } from "@/lib/companies/access";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import { createAutomationInvoicePurchase } from "@/lib/billing/stripe";
import { getTemplateById } from "@/lib/automations/catalog";
import { isRealExecutionTemplate } from "@/lib/n8n/real-execution-config";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCompanyPermission("manage_billing");
    const { id } = await params;
    const companyId = access.company.id;

    const [opportunity, entitlements, subscription] = await Promise.all([
      prisma.opportunity.findFirst({ where: { id, companyId } }),
      getCompanyEntitlements(companyId),
      prisma.subscription.findFirst({
        where: {
          companyId,
          plan: { in: ["pro", "business"] },
          status: { in: ["active", "trialing"] },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (!opportunity) return NextResponse.json({ error: "Opportunité introuvable." }, { status: 404 });
    if (!isRealExecutionTemplate(opportunity.templateId)) {
      return NextResponse.json({ error: "Cette recommandation n'est pas encore achetable : son exécution réelle n'est pas disponible." }, { status: 409 });
    }
    if (!entitlements.canExecute || !subscription) {
      return NextResponse.json(
        {
          error: "Une offre Action ou Scale active est requise avant l'achat d'une automatisation.",
          upgradeRequired: true,
          href: "/app/settings#plans",
        },
        { status: 403 }
      );
    }
    if (!subscription.stripeCustomerId) {
      return NextResponse.json(
        {
          error: "Le moyen de paiement de l'entreprise n'est pas encore relié à Stripe. Ouvrez la facturation ou réactivez votre abonnement.",
          billingRequired: true,
          href: "/app/settings",
        },
        { status: 409 }
      );
    }

    const template = getTemplateById(opportunity.templateId);
    if (!template || template.priceEur <= 0) {
      return NextResponse.json({ error: "Prix d'automatisation invalide." }, { status: 409 });
    }

    const purchase = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;

        const existing = await tx.purchase.findUnique({
          where: { companyId_opportunityId: { companyId, opportunityId: opportunity.id } },
        });
        if (existing) {
          if (!existing.providerRef && existing.amountEur !== template.priceEur) {
            return tx.purchase.update({
              where: { id: existing.id },
              data: { amountEur: template.priceEur, status: "pending", paymentUrl: null },
            });
          }
          return existing;
        }

        return tx.purchase.create({
          data: {
            companyId,
            opportunityId: opportunity.id,
            amountEur: template.priceEur,
            status: "pending",
            provider: "stripe",
          },
        });
      },
      { timeout: 10_000 }
    );

    if (purchase.status === "paid") {
      return NextResponse.json({ paid: true, purchaseId: purchase.id, amountEur: purchase.amountEur });
    }

    if (purchase.providerRef && purchase.paymentUrl && ["pending", "payment_action_required", "payment_failed"].includes(purchase.status)) {
      return NextResponse.json({
        paid: false,
        purchaseId: purchase.id,
        amountEur: purchase.amountEur,
        paymentUrl: purchase.paymentUrl,
        status: purchase.status,
      });
    }

    const invoice = await createAutomationInvoicePurchase({
      purchaseId: purchase.id,
      companyId,
      opportunityId: opportunity.id,
      templateId: opportunity.templateId,
      title: opportunity.title,
      amountEur: purchase.amountEur,
      stripeCustomerId: subscription.stripeCustomerId,
    });

    const nextStatus = invoice.paid ? "paid" : invoice.paymentError ? "payment_action_required" : "pending";
    const saved = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          providerRef: invoice.invoiceId,
          paymentUrl: invoice.hostedInvoiceUrl,
          status: nextStatus,
          paidAt: invoice.paid ? new Date() : null,
        },
      });
      await tx.event.create({
        data: {
          companyId,
          userId: access.session.user.id,
          type: invoice.paid ? "AUTOMATION_PURCHASE_PAID" : "AUTOMATION_PURCHASE_INITIATED",
          metadata: JSON.stringify({
            purchaseId: purchase.id,
            opportunityId: opportunity.id,
            templateId: opportunity.templateId,
            amountEur: purchase.amountEur,
            stripeInvoiceId: invoice.invoiceId,
            status: nextStatus,
            actorRole: access.role,
          }),
        },
      });
      return updated;
    });

    return NextResponse.json({
      paid: saved.status === "paid",
      purchaseId: saved.id,
      amountEur: saved.amountEur,
      status: saved.status,
      paymentUrl: saved.paymentUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.json({ error: "Seul le Propriétaire peut autoriser cet achat." }, { status: 403 });
    }
    console.error("Automation purchase failed", error);
    return NextResponse.json(
      { error: "Le paiement de l'automatisation n'a pas pu être préparé. Aucun workflow n'a été activé." },
      { status: 502 }
    );
  }
}
