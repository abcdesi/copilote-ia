import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma } from "../lib/db/client";
import { getTemplateById } from "../lib/automations/catalog";
import {
  AUTOMATION_PURCHASE_TERMS_VERSION,
  acceptsCurrentAutomationPurchaseTerms,
} from "../lib/billing/purchase-terms";
import { recordFirstDigitalProductUse } from "../lib/billing/automation-purchase-evidence";
import {
  evaluateAutomationPurchaseQuantity,
  getMonthlyAutomationPurchaseLimit,
} from "../lib/billing/automation-purchase-policy";

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

    assert.equal(getMonthlyAutomationPurchaseLimit("starter"), 2);
    assert.equal(getMonthlyAutomationPurchaseLimit("pro"), null);
    assert.equal(evaluateAutomationPurchaseQuantity({ plan: "starter", committedCount: 2 }).reached, true);
    assert.equal(evaluateAutomationPurchaseQuantity({ plan: "starter", committedCount: 1 }).remaining, 1);

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
    await prisma.purchase.update({
      where: { id: purchase.id },
      data: {
        providerRef: "in_test_unique_invoice",
        status: "paid",
        paidAt: new Date(),
        deliveredAt,
        firstUsedAt: null,
      },
    });
    let evidenced = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    assert.ok(evidenced.deliveredAt);
    assert.equal(evidenced.firstUsedAt, null, "La livraison ne doit pas être confondue avec un usage réel.");

    const automation = await prisma.automation.create({
      data: {
        companyId: company.id,
        opportunityId: opportunity.id,
        templateId: template.id,
        name: template.title,
        businessGoal: template.businessGoal,
        status: "active",
        health: "green",
        toolsUsed: JSON.stringify(template.relevantTools.slice(0, 3)),
        estimatedHoursPerMonth: template.estimatedHoursPerMonth,
        estimatedValueEur: 280,
      },
    });
    const run = await prisma.automationRun.create({
      data: {
        automationId: automation.id,
        status: "success",
        source: "manual",
        itemsProcessed: 3,
        actorUserId: user.id,
        actorName: user.name,
        actorEmail: user.email,
        actorRole: "owner",
        finishedAt: new Date(),
      },
    });

    assert.equal(
      await recordFirstDigitalProductUse({
        companyId: company.id,
        opportunityId: opportunity.id,
        automationId: automation.id,
        runId: run.id,
        source: "manual",
        sentCount: 0,
      }),
      false,
      "Une exécution sans élément traité ne doit pas créer de preuve de premier usage."
    );
    evidenced = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    assert.equal(evidenced.firstUsedAt, null);

    assert.equal(
      await recordFirstDigitalProductUse({
        companyId: company.id,
        opportunityId: opportunity.id,
        automationId: automation.id,
        runId: run.id,
        source: "manual",
        sentCount: 3,
      }),
      true,
      "Le premier usage réel doit être enregistré dès qu'une exécution traite quelque chose."
    );
    evidenced = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    assert.ok(evidenced.firstUsedAt);
    const firstUsedAt = evidenced.firstUsedAt;

    assert.equal(
      await recordFirstDigitalProductUse({
        companyId: company.id,
        opportunityId: opportunity.id,
        automationId: automation.id,
        runId: run.id,
        source: "manual",
        sentCount: 2,
      }),
      false,
      "La preuve de premier usage doit être idempotente."
    );
    evidenced = await prisma.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    assert.equal(evidenced.firstUsedAt?.getTime(), firstUsedAt?.getTime());
    assert.equal(
      await prisma.event.count({
        where: { companyId: company.id, type: "AUTOMATION_DIGITAL_PRODUCT_FIRST_USED" },
      }),
      1,
      "Un achat ne doit produire qu'une seule preuve de premier usage."
    );

    const outcome = await prisma.automationOutcome.create({
      data: {
        automationId: automation.id,
        kind: "time_saved_weekly_hours",
        value: 2.5,
        unit: "hours_per_week",
        source: "user_reported",
        confidence: 0.75,
        note: "Mesure déclarée après la première semaine d'utilisation.",
        actorUserId: user.id,
        actorName: user.name,
        actorEmail: user.email,
        actorRole: "owner",
      },
    });
    assert.equal(outcome.source, "user_reported");
    assert.equal(outcome.value, 2.5);
    assert.equal(outcome.actorUserId, user.id);

    const purchaseRoute = readFileSync("app/api/opportunities/[id]/purchase/route.ts", "utf-8");
    const webhookRoute = readFileSync("app/api/billing/webhook/route.ts", "utf-8");
    const installRoute = readFileSync("app/api/opportunities/[id]/install/route.ts", "utf-8");
    const executionSource = readFileSync("lib/n8n/execution.ts", "utf-8");
    const feedbackRoute = readFileSync("app/api/automations/[id]/feedback/route.ts", "utf-8");

    assert.ok(
      purchaseRoute.includes("acceptsCurrentAutomationPurchaseTerms") &&
        purchaseRoute.includes("createAutomationInvoicePurchase"),
      "Le parcours doit conserver acceptation contractuelle puis création du paiement Stripe."
    );
    assert.ok(
      purchaseRoute.includes('plan: { in: ["starter", "pro", "business"] }') &&
        purchaseRoute.includes("evaluateAutomationPurchaseQuantity") &&
        purchaseRoute.includes("automationQuantityCapReached") &&
        purchaseRoute.includes("FOR UPDATE"),
      "Core doit pouvoir acheter une automatisation, avec une limite mensuelle de quantité sérialisée avant création du paiement."
    );
    assert.ok(
      webhookRoute.includes('event.type === "invoice.paid"') &&
        webhookRoute.includes("handleAutomationInvoice"),
      "Le webhook Stripe doit pouvoir matérialiser le paiement de l'achat."
    );
    assert.ok(
      installRoute.includes('purchase.status !== "paid"') &&
        installRoute.includes("data: { deliveredAt }") &&
        installRoute.includes("Core, Action ou Scale"),
      "L'installation Core/Action/Scale doit exiger un achat payé puis tracer la livraison."
    );
    assert.ok(
      executionSource.includes("recordFirstDigitalProductUse"),
      "L'exécution réelle doit tracer le premier usage du produit numérique."
    );
    assert.ok(
      feedbackRoute.includes("automationOutcome.create") &&
        feedbackRoute.includes('source: "user_reported"'),
      "Le résultat métier doit rester distinct de la simple preuve d'exécution."
    );

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
