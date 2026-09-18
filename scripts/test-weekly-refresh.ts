import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/db/client";
import { runWeeklyBusinessRefresh } from "../lib/intelligence/weekly-refresh";
import { getCompanyEntitlements } from "../lib/billing/entitlements";

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
    await prisma.company.update({ where: { id: company.id }, data: { additionalSeats: 4 } });
    const entitlements = await getCompanyEntitlements(company.id);
    assert.equal(entitlements.seatLimit, 14, "Scale doit additionner les sièges approuvés aux 10 sièges inclus.");

    const concurrent = await Promise.all([
      runWeeklyBusinessRefresh(company.id),
      runWeeklyBusinessRefresh(company.id),
    ]);
    const executed = concurrent.filter((result) => result.ok && !result.skipped);
    const skipped = concurrent.filter((result) => result.ok && result.skipped);
    assert.equal(executed.length, 1, "Un seul refresh concurrent doit réellement travailler.");
    assert.equal(skipped.length, 1, "Le second refresh concurrent doit être ignoré.");

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

    // Simule la semaine suivante avec un contexte qui ne soutient plus l'ancienne
    // recommandation. Elle doit sortir de la liste active sans être supprimée.
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await prisma.event.updateMany({
      where: { companyId: company.id, type: { in: ["WEEKLY_REFRESH_STARTED", "WEEKLY_REFRESH_COMPLETED"] } },
      data: { createdAt: oldDate },
    });
    await prisma.company.update({
      where: { id: company.id },
      data: {
        objectives: "Structurer la gouvernance interne.",
        painPoints: "Aucun problème commercial prioritaire cette semaine.",
        salesContext: null,
        industry: null,
      },
    });

    const nextWeek = await runWeeklyBusinessRefresh(company.id);
    assert.equal(nextWeek.ok, true);
    assert.equal(nextWeek.skipped, false);
    const staleOpportunity = await prisma.opportunity.findFirst({
      where: { companyId: company.id, templateId: "relance-prospects" },
    });
    assert.equal(staleOpportunity?.status, "stale", "Une recommandation hebdo devenue non pertinente doit être archivée logiquement.");

    console.log("Weekly refresh bounded/idempotent/lifecycle tests: OK");
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
