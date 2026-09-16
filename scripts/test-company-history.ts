import assert from "node:assert/strict";
import { prisma } from "../lib/db/client";
import { getCompanyContextHistory, compactHistoryForContext } from "../lib/companies/history";
import { rebuildBusinessGraph } from "../lib/business-graph";
import { buildChatContext } from "../lib/companies/context";

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let userId: string | null = null;
  let companyId: string | null = null;

  try {
    const user = await prisma.user.create({
      data: {
        email: `history-test-${suffix}@pilotzia.test`,
        passwordHash: "integration-test-only",
        name: "Historique test",
      },
    });
    userId = user.id;

    const company = await prisma.company.create({
      data: {
        userId: user.id,
        name: "Entreprise historique",
        industry: "Services B2B",
        country: "France",
        employeeCount: 18,
        objectives: "Améliorer la marge et réduire le délai de réponse commercial.",
        financeContext: "Marge actuelle 28 %, suivi de trésorerie mensuel.",
        hrContext: "18 salariés, recrutements surtout en septembre et octobre.",
      },
    });
    companyId = company.id;

    const revisions = [
      {
        section: "finance",
        field: "financeContext",
        previous: "Marge 25 %.",
        next: "Marge actuelle 28 %, suivi de trésorerie mensuel.",
        effectiveAt: "2026-09-10T10:00:00.000Z",
      },
      {
        section: "hr",
        field: "hrContext",
        previous: "15 salariés, recrutement ponctuel.",
        next: "18 salariés, recrutements surtout en septembre et octobre.",
        effectiveAt: "2026-09-12T10:00:00.000Z",
      },
      {
        section: "objectives",
        field: "objectives",
        previous: "Augmenter le CA.",
        next: "Améliorer la marge et réduire le délai de réponse commercial.",
        effectiveAt: "2026-09-14T10:00:00.000Z",
      },
    ];

    await prisma.companyContextRevision.createMany({
      data: revisions.map((revision) => ({
        companyId: company.id,
        section: revision.section,
        field: revision.field,
        previousValueJson: JSON.stringify(revision.previous),
        nextValueJson: JSON.stringify(revision.next),
        source: "company_profile",
        effectiveAt: new Date(revision.effectiveAt),
      })),
    });

    await rebuildBusinessGraph(company.id);

    const history = await getCompanyContextHistory(company.id, 100);
    assert.equal(history.length, 3);
    assert.equal(history[0].section, "objectives");
    assert.match(String(history.find((item) => item.section === "finance")?.previous), /25/);
    assert.match(String(history.find((item) => item.section === "finance")?.next), /28/);

    const compactFinance = compactHistoryForContext(history, ["finance", "accounting"]);
    assert.ok(compactFinance.some((item) => item.s === "finance"));
    assert.ok(compactFinance.some((item) => item.s === "objectives"));
    assert.equal(compactFinance.some((item) => item.s === "hr"), false);

    const context = await buildChatContext(company.id);
    assert.equal(context.contextHistory?.length, 3);
    const historyEvidence = context.evidence?.filter((item) => item.source === "pilotzia-history") ?? [];
    assert.equal(historyEvidence.length, 3);
    assert.ok(historyEvidence.some((item) => item.predicate.includes("finance")));

    await prisma.company.delete({ where: { id: company.id } });
    companyId = null;
    assert.equal(await prisma.companyContextRevision.count({ where: { companyId: company.id } }), 0);

    console.log("✓ historique complet : anciennes et nouvelles valeurs conservées");
    console.log("✓ mobilisation compacte : seuls les changements pertinents sont sélectionnables");
    console.log("✓ copilote : historique temporel exposé comme preuve distincte sans remplacer l'état courant");
    console.log("✓ confidentialité : l'historique est supprimé en cascade avec l'entreprise");
  } finally {
    if (companyId) await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});