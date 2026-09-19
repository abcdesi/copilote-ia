import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireCompanyPermission } from "@/lib/companies/access";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import { createAutomationInvoicePurchase } from "@/lib/billing/stripe";
import { getTemplateById } from "@/lib/automations/catalog";
import { isRealExecutionTemplate } from "@/lib/n8n/real-execution-config";
import {
  AUTOMATION_PURCHASE_PRODUCT_KIND,
  AUTOMATION_PURCHASE_TERMS_VERSION,
  acceptsCurrentAutomationPurchaseTerms,
} from "@/lib/billing/purchase-terms";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCompanyPermission("manage_billing");
    const { id } = await params;
    const companyId = access.company.id;
    const requestBody = await req.json().catch(() => null);
    const termsAccepted = acceptsCurrentAutomationPurchaseTerms(requestBody);
    const termsAcceptedAt = termsAccepted ? new Date() : null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 240) ?? null;

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

    const purchaseDecision = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;

        const existing = await tx.purchase.findUnique({
          where: { companyId_opportunityId: { companyId, opportunityId: opportunity.id } },
        });
        if (existing?.status === "paid") {
          return { blocked: false as const, termsRequired: false as const, purchase: existing };
        }

        if (!termsAccepted || !termsAcceptedAt) {
          return { blocked: false as const, termsRequired: true as const };
        }

        const acceptanceData = {
          termsVersion: AUTOMATION_PURCHASE_TERMS_VERSION,
          termsAcceptedAt,
          termsAcceptedByUserId: access.session.user.id,
          termsAcceptedByEmail: access.session.user.email ?? null,
          immediateFulfillmentRequestedAt: termsAcceptedAt,
        };

        if (existing) {
          if (existing.status === "void") {
            const updated = await tx.purchase.update({
              where: { id: existing.id },
              data: {
                amountEur: template.priceEur,
                status: "pending",
                providerRef: null,
                paymentUrl: null,
                paidAt: null,
                billingAttempt: { increment: 1 },
                ...acceptanceData,
              },
            });
            return { blocked: false as const, purchase: updated };
          }
          if (!existing.providerRef && existing.amountEur !== template.priceEur) {
            const updated = await tx.purchase.update({
              where: { id: existing.id },
              data: { amountEur: template.priceEur, status: "pending", paymentUrl: null, ...acceptanceData },
            });
            return { blocked: false as const, purchase: updated };
          }
          const updated = await tx.purchase.update({
            where: { id: existing.id },
            data: acceptanceData,
          });
          return { blocked: false as const, termsRequired: false as const, purchase: updated };
        }

        const company = await tx.company.findUnique({
          where: { id: companyId },
          select: { automationPurchaseMonthlyCapEur: true },
        });
        const monthlyCapEur = Math.max(0, company?.automationPurchaseMonthlyCapEur ?? 0);
        const now = new Date();
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const committed = await tx.purchase.aggregate({
          where: {
            companyId,
            createdAt: { gte: monthStart },
            status: { in: ["pending", "payment_action_required", "payment_failed", "paid"] },
          },
          _sum: { amountEur: true },
        });
        const committedEur = committed._sum.amountEur ?? 0;
        if (committedEur + template.priceEur > monthlyCapEur) {
          return {
            blocked: true as const,
            monthlyCapEur,
            committedEur,
            requestedEur: template.priceEur,
          };
        }

        const purchase = await tx.purchase.create({
          data: {
            companyId,
            opportunityId: opportunity.id,
            amountEur: template.priceEur,
            status: "pending",
            provider: "stripe",
            ...acceptanceData,
          },
        });
        return { blocked: false as const, termsRequired: false as const, purchase };
      },
      { timeout: 10_000 }
    );

    if ("termsRequired" in purchaseDecision && purchaseDecision.termsRequired) {
      return NextResponse.json(
        {
          error: "Vous devez confirmer les conditions de l'achat numérique avant le paiement.",
          termsRequired: true,
          termsVersion: AUTOMATION_PURCHASE_TERMS_VERSION,
        },
        { status: 400 }
      );
    }

    if (purchaseDecision.blocked) {
      return NextResponse.json(
        {
          error: `Cet achat dépasserait le plafond mensuel d'automatisations (${purchaseDecision.monthlyCapEur} € HT). Modifiez le plafond dans Compte & abonnement si vous souhaitez continuer.`,
          purchaseCapReached: true,
          monthlyCapEur: purchaseDecision.monthlyCapEur,
          committedEur: purchaseDecision.committedEur,
          requestedEur: purchaseDecision.requestedEur,
          href: "/app/settings#automation-purchases",
        },
        { status: 409 }
      );
    }

    const purchase = purchaseDecision.purchase;

    if (purchase.status !== "paid" && termsAcceptedAt) {
      await prisma.event.create({
        data: {
          companyId,
          userId: access.session.user.id,
          type: "AUTOMATION_PURCHASE_TERMS_ACCEPTED",
          metadata: JSON.stringify({
            purchaseId: purchase.id,
            opportunityId: opportunity.id,
            templateId: opportunity.templateId,
            productKind: AUTOMATION_PURCHASE_PRODUCT_KIND,
            amountEur: purchase.amountEur,
            termsVersion: AUTOMATION_PURCHASE_TERMS_VERSION,
            termsAcceptedAt: termsAcceptedAt.toISOString(),
            immediateFulfillmentRequestedAt: termsAcceptedAt.toISOString(),
            actorRole: access.role,
            actorEmail: access.session.user.email ?? null,
            userAgent,
          }),
        },
      });
    }

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
      billingAttempt: purchase.billingAttempt,
      termsVersion: purchase.termsVersion ?? AUTOMATION_PURCHASE_TERMS_VERSION,
      termsAcceptedAt: purchase.termsAcceptedAt ?? termsAcceptedAt ?? new Date(),
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
