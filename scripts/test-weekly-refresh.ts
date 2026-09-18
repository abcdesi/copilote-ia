import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/db/client";
import { runWeeklyBusinessRefresh } from "../lib/intelligence/weekly-refresh";

async function main() {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `weekly-refresh-${suffix}@pilotzia.invalid`,
      passwordHash: "integration-test-only",
      name: "Weekly Refresh Test",
    },
  });

  const company = await prisma.company.create({
    data: {
      userId: user.id,
      name: "Pilotzia Weekly Test",
      industry: "Conseil B2B",
      country: "France métropolitaine",
      objectives: "Augmenter le nombre de rendez-vous commerciaux sans ajouter de charge manuelle.",
      painPoints: "Nous oublions de relancer les prospects sans réponse et les relances commerciales prennent plusieurs heures chaque semaine.",
      salesContext: "Prospects B2B, relances récurrentes et suivi commercial par email.",
      tools: { create: [{ name: "Gmail", detected: false }] },
      memberships: { create: { userId: user.id, role: "owner", status: "active" } },
    },
  });

  try {
    await prisma.subscription.create({
      data: {
        companyId: company.id,
        plan: "business",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        billingInterval: "month",
      },
    });

    const first = await runWeeklyBusinessRefresh(company.id);
    assert.equal(first.ok, true);
    assert.equal(first.skipped, false);

    const completion = await prisma.event.findFirst({
      where: { companyId: company.id, type: "WEEKLY_REFRESH_COMPLETED" },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(completion?.metadata);
    const metadata = JSON.parse(completion?.metadata ?? "{}");
    assert.equal(metadata.aiTriggered, false);
    assert.equal(metadata.aiCreditsUsed, 0);
    assert.equal(metadata.aiVariableCostEur, 0);

    const reservations = await prisma.event.count({
      where: { companyId: company.id, type: "USAGE_RESERVED" },
    });
    assert.equal(reservations, 0, "Le refresh déterministe ne doit pas consommer de crédits IA.");

    const opportunities = await prisma.opportunity.findMany({ where: { companyId: company.id } });
    assert.ok(opportunities.some((opportunity) => opportunity.templateId === "relance-prospects"));

    const graphFacts = await prisma.businessFact.count({ where: { companyId: company.id } });
    assert.ok(graphFacts > 0);

    const second = await runWeeklyBusinessRefresh(company.id);
    assert.equal(second.ok, true);
    assert.equal(second.skipped, true);
    if (second.skipped) assert.equal(second.reason, "already_fresh");

    const opportunityCountAfterSecondRun = await prisma.opportunity.count({ where: { companyId: company.id } });
    assert.equal(opportunityCountAfterSecondRun, opportunities.length, "Le refresh hebdomadaire ne doit pas dupliquer les opportunités.");

    console.log("Weekly refresh bounded/idempotent tests: OK");
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
