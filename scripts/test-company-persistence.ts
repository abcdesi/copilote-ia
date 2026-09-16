import assert from "node:assert/strict";
import { prisma } from "../lib/db/client";
import { rebuildBusinessGraph } from "../lib/business-graph";
import { getCompanyKnowledgeCoverage } from "../lib/companies/knowledge-coverage";
import { buildChatContext } from "../lib/companies/context";
import { buildCompanyProfileSummary } from "../lib/companies/profile-summary";

const detailed = (label: string) => Array.from({ length: 75 }, (_, index) => `${label}${index + 1}`).join(" ");

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let userId: string | null = null;

  try {
    const user = await prisma.user.create({
      data: {
        email: `knowledge-test-${suffix}@pilotzia.test`,
        passwordHash: "integration-test-only",
        name: "Entreprise test connaissance",
      },
    });
    userId = user.id;

    const company = await prisma.company.create({
      data: {
        userId: user.id,
        name: "Atelier Pilotzia Test",
        industry: "Conseil B2B",
        country: "France",
        sizeRange: "6-20",
        employeeCount: 12,
        objectives: detailed("objectif"),
        painPoints: detailed("irritant"),
        businessModel: detailed("modele"),
        customerProfile: detailed("client"),
        localContext: detailed("local"),
        financeContext: detailed("finance"),
        accountingContext: detailed("compta"),
        salesContext: detailed("vente"),
        marketingContext: detailed("marketing"),
        hrContext: detailed("rh"),
        operationsContext: detailed("operation"),
        tools: {
          create: [
            { name: "HubSpot", detected: false },
            { name: "Pennylane", detected: false },
            { name: "Slack", detected: false },
            { name: "Notion", detected: false },
          ],
        },
      },
      include: { tools: true },
    });

    await rebuildBusinessGraph(company.id);

    const persisted = await prisma.company.findUniqueOrThrow({
      where: { id: company.id },
      include: { tools: true },
    });
    assert.match(persisted.hrContext ?? "", /rh1/);
    assert.match(persisted.financeContext ?? "", /finance1/);
    assert.equal(persisted.tools.length, 4);

    const profileFacts = await prisma.businessFact.findMany({
      where: {
        companyId: company.id,
        sourceProvider: "pilotzia",
        sourceRef: { startsWith: "graph:company:" },
      },
      select: { predicate: true, provenanceJson: true },
    });
    const predicates = new Set(profileFacts.map((fact) => fact.predicate));
    for (const predicate of [
      "finance_context",
      "accounting_context",
      "sales_context",
      "marketing_context",
      "hr_context",
      "operations_context",
    ]) {
      assert.ok(predicates.has(predicate), `fait Business Graph manquant : ${predicate}`);
    }
    assert.ok(profileFacts.every((fact) => (fact.provenanceJson ?? "").includes("company_profile")));

    const coverage = await getCompanyKnowledgeCoverage(company.id);
    for (const key of ["finance", "accounting", "sales", "marketing", "hr", "operations"]) {
      const score = coverage.sections.find((section) => section.key === key)?.score;
      assert.equal(score, 60, `${key} doit rester à 60 % sans source connectée indépendante`);
    }
    assert.equal(coverage.overall, 78);

    const chatContext = await buildChatContext(company.id);
    assert.match(chatContext.domainContexts.hr ?? "", /rh1/);
    assert.match(chatContext.domainContexts.finance ?? "", /finance1/);
    assert.equal(chatContext.knowledgeCoverage.overall, 78);
    assert.equal(chatContext.evidence.some((fact) => fact.predicate === "hr_context"), false);
    assert.equal(chatContext.evidence.some((fact) => fact.predicate === "finance_context"), false);

    const summary = buildCompanyProfileSummary(persisted);
    assert.equal(summary.length, 12);
    assert.ok(summary.every((item) => item.filled));
    assert.match(summary.find((item) => item.key === "hr")?.summary ?? "", /rh1/);

    // Simulation d'une modification depuis "Mon entreprise" : la valeur sauvegardée,
    // son fait dérivé, le résumé affiché et le contexte du copilote doivent tous changer ensemble.
    const updatedHr = detailed("rhmodifie");
    await prisma.company.update({ where: { id: company.id }, data: { hrContext: updatedHr } });
    await rebuildBusinessGraph(company.id);

    const modified = await prisma.company.findUniqueOrThrow({
      where: { id: company.id },
      include: { tools: true },
    });
    assert.match(modified.hrContext ?? "", /rhmodifie1/);

    const modifiedHrFact = await prisma.businessFact.findFirstOrThrow({
      where: { companyId: company.id, sourceRef: "graph:company:hr_context" },
      select: { valueJson: true, provenanceJson: true },
    });
    assert.match(modifiedHrFact.valueJson ?? "", /rhmodifie1/);
    assert.match(modifiedHrFact.provenanceJson ?? "", /company_profile/);

    const modifiedSummary = buildCompanyProfileSummary(modified);
    assert.match(modifiedSummary.find((item) => item.key === "hr")?.summary ?? "", /rhmodifie1/);

    const modifiedChatContext = await buildChatContext(company.id);
    assert.match(modifiedChatContext.domainContexts.hr ?? "", /rhmodifie1/);
    assert.equal(modifiedChatContext.evidence.some((fact) => fact.predicate === "hr_context"), false);

    console.log("✓ Persistance Company validée pour toutes les rubriques métier");
    console.log(`✓ ${profileFacts.length} faits déclaratifs reconstruits avec provenance dans le Business Graph`);
    console.log("✓ Le copilote distingue les déclarations du dirigeant des preuves indépendantes");
    console.log("✓ Modification RH propagée au dossier, au résumé, au Business Graph et au copilote");
    console.log(`✓ Score après saisie complète sans connexion : ${coverage.overall}%`);
  } finally {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
