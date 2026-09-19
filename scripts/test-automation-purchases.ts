import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/db/client";
import { getTemplateById } from "../lib/automations/catalog";
import {
  AUTOMATION_PURCHASE_TERMS_VERSION,
  acceptsCurrentAutomationPurchaseTerms,
} from "../lib/billing/purchase-terms";

function prismaCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

async function main() {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `automation-purchase-${suffix}@pilotzia.invalid`,
      passwordHash: "integration-test-only",
      name: "Automation Purchase Test",
    },
  });

  const company = await prisma.company.create({
    data: {
      userId: user.id,
      name: "Purchase Test Company",
      industry: "Conseil B2B",
      country: "France métropolitaine",
      memberships: { create: { userId: user.id, role: "owner", status: "active" } },
    },
  });

  try {
    const reloaded = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    assert.equal(reloaded.automationPurchaseMonthlyCapEur, 250);

    const template = getTemplateById("relance-prospects");
    assert.ok(template);
    assert.equal(template.priceEur, 29);

    const opportunity = await prisma.opportunity.create({
      data: {
        companyId: company.id,
        templateId: template.id,
        title: template.title,
        description: template.description,
        category: template.category,
        impactLevel: template.impactLevel,
        complexity: template.complexity,
        estimatedHoursPerMonth: template.estimatedHoursPerMonth,
        estimatedValueEur: 280,
        priceEur: template.priceEur,
      },
    });

    assert.equal(
      acceptsCurrentAutomationPurchaseTerms({
        acceptDigitalTerms: true,
        termsVersion: AUTOMATION_PURCHASE_TERMS_VERSION,
      }),
      true
    );
    assert.equal(
      acceptsCurrentAutomationPurchaseTerms({
        acceptDigitalTerms: false,
        termsVersion: AUTOMATION_PURCHASE_TERMS_VERSION,
      }),
      false
    );

    const termsAcceptedAt = new Date();
    const purchase = await prisma.purchase.create({
      data: {
        companyId: company.id,
        opportunityId: opportunity.id,
        amountEur: template.priceEur,
        status: "pending",
        termsVersion: AUTOMATION_PURCHASE_TERMS_VERSION,
        termsAcceptedAt,
        termsAcceptedByUserId: user.id,
        termsAcceptedByEmail: user.email,
        immediateFulfillmentRequestedAt: termsAcceptedAt,
      },
    });
    assert.equal(purchase.amountEur, 29);
    assert.equal(purchase.termsVersion, AUTOMATION_PURCHASE_TERMS_VERSION);
    assert.equal(purchase.termsAcceptedByUserId, user.id);
    assert.ok(purchase.immediateFulfillmentRequestedAt);

    let duplicateCode = "";
    try {
      await prisma.purchase.create({
        data: {
          companyId: company.id,
          opportunityId: opportunity.id,
          amountEur: template.priceEur,
          status: "pending",
        },
      });
    } catch (error) {
      duplicateCode = prismaCode(error);
    }
    assert.equal(duplicateCode, "P2002", "Un double achat de la même opportunité doit être rejeté par la base.");

    const deliveredAt = new Date();
    const firstUsedAt = new Date(deliveredAt.getTime() + 1000);
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        providerRef: "in_test_unique_invoice",
        status: "paid",
        paidAt: new Date(),
        deliveredAt,
        firstUsedAt,
      },
    });
    const evidenced = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    assert.ok(evidenced.deliveredAt);
    assert.ok(evidenced.firstUsedAt);

    const otherOpportunity = await prisma.opportunity.create({
      data: {
        companyId: company.id,
        templateId: "reporting-hebdo",
        title: "Reporting hebdomadaire",
        description: "Test",
        category: "Productivité",
        impactLevel: "medium",
        complexity: "low",
        estimatedHoursPerMonth: 3,
        estimatedValueEur: 105,
        priceEur: 29,
      },
    });

    let providerRefCode = "";
    try {
      await prisma.purchase.create({
        data: {
          companyId: company.id,
          opportunityId: otherOpportunity.id,
          amountEur: 29,
          status: "paid",
          providerRef: "in_test_unique_invoice",
        },
      });
    } catch (error) {
      providerRefCode = prismaCode(error);
    }
    assert.equal(providerRefCode, "P2002", "Une référence Stripe ne doit jamais régler deux achats.");

    console.log("Automation purchase billing tests: OK");
  } finally {
    await prisma.company.delete({ where: { id: company.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
