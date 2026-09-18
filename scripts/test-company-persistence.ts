import assert from "node:assert/strict";
import { prisma } from "../lib/db/client";
import { rebuildBusinessGraph } from "../lib/business-graph";
import { syncBusinessRhythms } from "../lib/business-graph/rhythms";
import { getCompanyKnowledgeCoverage } from "../lib/companies/knowledge-coverage";
import { buildChatContext } from "../lib/companies/context";
import { buildCompanyProfileSummary } from "../lib/companies/profile-summary";

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let userId: string | null = null;
  let companyId: string | null = null;

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
        objectives: "Augmenter le CA de 15 % d'ici 90 jours tout en améliorant la marge de 3 points.",
        painPoints: "Les commerciaux perdent 5 heures par semaine sur les relances de prospects, ce qui ralentit la conversion et le CA.",
        businessModel: "Prestations au forfait et contrats récurrents, panier moyen 5 000 €.",
        customerProfile: "PME B2B de 10 à 100 salariés, décideur dirigeant ou DAF.",
        localContext: "Marché français, saisonnalité T4, contraintes réglementaires locales, langue française.",
        financeContext: "CA 1,2 M€, marge 32 %, trésorerie 180 k€, créances 95 k€ dont 30 k€ en retard, dette 120 k€, charges principales masse salariale et sous-traitance, prévision de cash mensuelle.",
        accountingContext: "Pennylane avec expert-comptable, facturation suivie chaque semaine, clôture mensuelle à J+10, rapprochement bancaire hebdomadaire, relances J+7/J+15 et reporting mensuel avec balance. Le bilan annuel est préparé en mars.",
        salesContext: "80 leads par mois dans HubSpot, pipeline en 5 étapes valorisé 250 k€, taux de réponse 35 % et conversion 18 %, devis suivis, cycle moyen 42 jours, relances J+3/J+10.",
        marketingContext: "SEO, LinkedIn et Google Ads, budget 8 k€/mois, CPL 42 €, campagnes et contenu hebdomadaires, conversion lead 4,5 %, attribution UTM, cible PME B2B.",
        hrContext: "12 salariés organisés en 3 pôles avec 2 managers. Les recrutements sont surtout concentrés en septembre et octobre. 4 recrutements par an, onboarding sur 10 jours, surcharge de 6 h/semaine côté commercial, congés et entretiens dans Lucca, turnover 9 %, préparation des arrivées encore manuelle.",
        operationsContext: "Processus critiques livraison et support, 45 dossiers/mois et 120 tickets/mois, réunion hebdomadaire, délai cible 48 h, contrôle qualité, blocage sur validation dirigeant, passages entre Notion, Slack et email.",
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

    companyId = company.id;

    await rebuildBusinessGraph(company.id);
    await syncBusinessRhythms(company.id);

    const persisted = await prisma.company.findUniqueOrThrow({
      where: { id: company.id },
      include: { tools: true },
    });
    assert.match(persisted.hrContext ?? "", /12 salariés/);
    assert.match(persisted.financeContext ?? "", /1,2 M€/);
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

    const rhythmFacts = await prisma.businessFact.findMany({
      where: { companyId: company.id, sourceProvider: "pilotzia-memory", predicate: "business_rhythm" },
      select: { valueJson: true, provenanceJson: true },
    });
    assert.ok(rhythmFacts.length >= 2, `au moins deux rythmes attendus, obtenu ${rhythmFacts.length}`);
    assert.ok(rhythmFacts.some((fact) => (fact.valueJson ?? "").includes('"k":"annual_accounts"')));
    assert.ok(rhythmFacts.some((fact) => (fact.valueJson ?? "").includes('"k":"recruitment_period"')));
    assert.ok(rhythmFacts.every((fact) => !(fact.valueJson ?? "").includes("12 salariés")));
    assert.ok(rhythmFacts.every((fact) => (fact.provenanceJson ?? "").includes('"rawStored":false')));

    const coverage = await getCompanyKnowledgeCoverage(company.id);
    for (const key of ["finance", "accounting", "sales", "marketing", "hr", "operations"]) {
      const score = coverage.sections.find((section) => section.key === key)?.score ?? 0;
      assert.ok(score >= 55 && score <= 60, `${key} doit rester déclaratif sans source indépendante, obtenu ${score}`);
    }
    assert.ok(coverage.overall >= 65, `couverture sémantique attendue >=65, obtenu ${coverage.overall}`);

    const chatContext = await buildChatContext(company.id);
    if (!chatContext.domainContexts || !chatContext.knowledgeCoverage || !chatContext.evidence) {
      throw new Error("Le contexte du copilote doit exposer domaines, couverture et preuves");
    }
    assert.match(chatContext.domainContexts.hr ?? "", /12 salariés/);
    assert.match(chatContext.domainContexts.finance ?? "", /1,2 M€/);
    assert.ok(chatContext.knowledgeCoverage.sections.find((section) => section.key === "hr")?.dimensions?.length);
    assert.ok(chatContext.businessRhythms?.some((rhythm) => rhythm.key === "recruitment_period"));
    assert.equal(chatContext.evidence.some((fact) => fact.predicate === "hr_context"), false);
    assert.equal(chatContext.evidence.some((fact) => fact.predicate === "finance_context"), false);
    assert.equal(chatContext.evidence.some((fact) => fact.predicate === "business_rhythm"), false);

    const summary = buildCompanyProfileSummary(persisted);
    assert.equal(summary.length, 12);
    assert.ok(summary.every((item) => item.filled));
    assert.match(summary.find((item) => item.key === "hr")?.summary ?? "", /12 salariés/);

    // Simulation d'une modification de la situation RH : dossier, graphe, mémoire récurrente,
    // résumé et copilote doivent refléter la nouvelle situation, pas l'ancienne formulation.
    const updatedHr = "14 salariés désormais, 3 pôles avec 2 managers. Les recrutements sont gelés ce trimestre. L'onboarding dure 7 jours dans Lucca, la surcharge se concentre maintenant sur le support à 9 h/semaine, turnover 8 %, préparation des arrivées toujours manuelle.";
    await prisma.company.update({ where: { id: company.id }, data: { hrContext: updatedHr } });
    await rebuildBusinessGraph(company.id);
    await syncBusinessRhythms(company.id);

    const modified = await prisma.company.findUniqueOrThrow({
      where: { id: company.id },
      include: { tools: true },
    });
    assert.match(modified.hrContext ?? "", /14 salariés désormais/);

    const modifiedHrFact = await prisma.businessFact.findFirstOrThrow({
      where: { companyId: company.id, sourceRef: "graph:company:hr_context" },
      select: { valueJson: true, provenanceJson: true },
    });
    assert.match(modifiedHrFact.valueJson ?? "", /14 salariés désormais/);
    assert.match(modifiedHrFact.provenanceJson ?? "", /company_profile/);

    const modifiedRhythms = await prisma.businessFact.findMany({
      where: { companyId: company.id, sourceProvider: "pilotzia-memory", predicate: "business_rhythm" },
      select: { valueJson: true },
    });
    assert.equal(modifiedRhythms.some((fact) => (fact.valueJson ?? "").includes('"k":"recruitment_period"')), false);

    const modifiedSummary = buildCompanyProfileSummary(modified);
    assert.match(modifiedSummary.find((item) => item.key === "hr")?.summary ?? "", /14 salariés désormais/);

    const modifiedChatContext = await buildChatContext(company.id);
    if (!modifiedChatContext.domainContexts || !modifiedChatContext.evidence) {
      throw new Error("Le contexte modifié du copilote doit rester complet");
    }
    assert.match(modifiedChatContext.domainContexts.hr ?? "", /14 salariés désormais/);
    assert.equal(modifiedChatContext.businessRhythms?.some((rhythm) => rhythm.key === "recruitment_period"), false);
    assert.equal(modifiedChatContext.evidence.some((fact) => fact.predicate === "hr_context"), false);

    console.log("✓ Persistance Company validée pour toutes les rubriques métier");
    console.log(`✓ ${profileFacts.length} faits déclaratifs reconstruits avec provenance dans le Business Graph`);
    console.log(`✓ ${rhythmFacts.length} rythmes métier compressés et stockés sans recopier le texte source`);
    console.log("✓ Le score dépend de dimensions utiles et non de la longueur du texte");
    console.log("✓ Le copilote distingue les déclarations du dirigeant des preuves indépendantes");
    console.log("✓ Une évolution RH remplace le contexte et supprime une ancienne récurrence devenue fausse");
    console.log(`✓ Score après saisie complète sans connexion : ${coverage.overall}%`);
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