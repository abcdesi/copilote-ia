import assert from "node:assert/strict";
import { computeCompanyKnowledgeCoverage, knowledgeIntentMatches, type KnowledgeModelInput, type KnowledgeSectionKey } from "../lib/companies/knowledge-model";
import { KNOWLEDGE_DIMENSIONS, assessDeclaredKnowledge } from "../lib/companies/knowledge-dimensions";
import { buildCompanyProfileSummary } from "../lib/companies/profile-summary";

const NOW = "2026-09-16T12:00:00.000Z";
const SECTION_KEYS: KnowledgeSectionKey[] = [
  "activity", "team", "objectives", "painPoints", "applications", "local",
  "finance", "accounting", "sales", "marketing", "hr", "operations",
];

function freshDates(): Partial<Record<KnowledgeSectionKey, string>> {
  return Object.fromEntries(SECTION_KEYS.map((key) => [key, NOW]));
}

function baseCompany(): KnowledgeModelInput["company"] {
  return {
    industry: "Conseil B2B",
    country: "France",
    sizeRange: "6-20",
    employeeCount: 12,
    objectives: "Augmenter le CA de 15 % d'ici 90 jours tout en améliorant la marge.",
    painPoints: "Les commerciaux perdent 5 heures par semaine sur les relances de prospects, ce qui ralentit la conversion et le CA.",
    businessModel: "Prestations au forfait avec contrats récurrents, panier moyen de 5 000 €.",
    customerProfile: "PME B2B de 10 à 100 salariés, décideur dirigeant ou direction financière.",
    localContext: "Marché français, activité saisonnière, contraintes réglementaires locales, français comme langue principale.",
    financeContext: null,
    marketingContext: null,
    accountingContext: null,
    salesContext: null,
    hrContext: "Équipe de 12 personnes organisée en pôles, avec managers et une tension de capacité côté commercial.",
    operationsContext: null,
  };
}

function compute(company: KnowledgeModelInput["company"], extra: Partial<KnowledgeModelInput> = {}) {
  return computeCompanyKnowledgeCoverage({
    company,
    tools: extra.tools ?? [],
    connections: extra.connections ?? [],
    facts: extra.facts ?? [],
    sectionUpdatedAt: extra.sectionUpdatedAt ?? freshDates(),
    now: NOW,
  });
}

function sectionScore(result: ReturnType<typeof computeCompanyKnowledgeCoverage>, key: string) {
  return result.sections.find((section) => section.key === key)?.score ?? -1;
}

// 1. Entreprise vide : le système reste prudent et donne un premier palier clair.
const empty = compute({
  industry: null,
  country: null,
  sizeRange: null,
  employeeCount: null,
  objectives: null,
  painPoints: null,
  businessModel: null,
  customerProfile: null,
  localContext: null,
  financeContext: null,
  marketingContext: null,
  accountingContext: null,
  salesContext: null,
  hrContext: null,
  operationsContext: null,
});
assert.equal(empty.overall, 0);
assert.equal(empty.nextMilestone?.score, 35);
assert.ok(empty.guidanceSteps.length > 0);

// 2. Le mot court "CA" ne doit pas être détecté à l'intérieur de "blocages".
assert.equal(knowledgeIntentMatches("réduire les blocages et les délais", "ca"), false);
assert.equal(knowledgeIntentMatches("augmenter le CA de 15 %", "ca"), true);
assert.equal(knowledgeIntentMatches("factures impayées", "factur"), true);

// 3. Répéter la même information RH ne fait pas monter le score.
const shortOnboarding = assessDeclaredKnowledge("hr", "Notre onboarding est manuel et l'intégration des nouveaux collaborateurs est manuelle.");
const repeatedOnboarding = assessDeclaredKnowledge(
  "hr",
  "Notre onboarding est manuel. L'intégration est manuelle. Chaque nouveau collaborateur est intégré manuellement. L'onboarding reste entièrement manuel et nous faisons toujours l'intégration à la main."
);
assert.deepEqual(shortOnboarding.coveredKeys, repeatedOnboarding.coveredKeys);
assert.equal(shortOnboarding.score, repeatedOnboarding.score);
assert.ok(shortOnboarding.coveredKeys.includes("onboarding"));
assert.ok(!shortOnboarding.coveredKeys.includes("hiring"));

// 4. Un enjeu temps/blocage priorise les opérations, sans faux positif commercial.
const operationsCompany = baseCompany();
operationsCompany.objectives = "Réduire les délais opérationnels de 30 % d'ici 90 jours.";
operationsCompany.painPoints = "La production perd 8 heures par semaine dans des blocages de validation et le support prend du retard.";
const operations = compute(operationsCompany, { tools: ["Slack", "Notion", "Gmail", "Calendar"] });
assert.equal(operations.guidanceSteps[0]?.sectionKey, "operations");
assert.notEqual(operations.guidanceSteps[0]?.sectionKey, "sales");

// 5. Un objectif revenu/prospection priorise le commercial.
const salesCompany = baseCompany();
salesCompany.objectives = "Augmenter le CA de 20 % sur 90 jours et améliorer la conversion du pipeline commercial.";
salesCompany.painPoints = "Les prospects répondent peu, les devis sont relancés tardivement et plusieurs leads restent sans suivi.";
const sales = compute(salesCompany, { tools: ["HubSpot", "Gmail", "Slack", "Notion"] });
assert.equal(sales.guidanceSteps[0]?.sectionKey, "sales");

// 6. Un enjeu marge/trésorerie priorise la finance.
const financeCompany = baseCompany();
financeCompany.objectives = "Améliorer la marge de 5 points et sécuriser trois mois de trésorerie avant la fin du trimestre.";
financeCompany.painPoints = "Les créances clients et plusieurs coûts récurrents pèsent sur le cash chaque mois.";
const finance = compute(financeCompany, { tools: ["Pennylane", "Stripe", "Gmail", "Notion"] });
assert.equal(finance.guidanceSteps[0]?.sectionKey, "finance");

// 7. Entreprise qui remplit toutes les dimensions : la déclaration seule peut atteindre 60 %
// sur un domaine, mais seulement si les informations sont distinctes et utiles.
const completeDeclaredCompany: KnowledgeModelInput["company"] = {
  ...baseCompany(),
  financeContext: "CA 1,2 M€ en hausse de 8 %, marge 32 %, trésorerie 180 k€, créances 95 k€ dont 30 k€ en retard, dette bancaire 120 k€, charges principales masse salariale et sous-traitance, prévision de cash mensuelle avec saisonnalité T4.",
  accountingContext: "Pennylane avec expert-comptable. Factures et avoirs suivis chaque semaine, clôture mensuelle à J+10, rapprochement bancaire hebdomadaire, relances d'impayés à J+7/J+15 et reporting mensuel avec balance et grand livre.",
  salesContext: "80 leads par mois dans HubSpot, pipeline en 5 étapes valorisé 250 k€, taux de réponse 35 % et conversion 18 %, devis suivis dans le CRM, cycle moyen 42 jours, relances à J+3/J+10.",
  marketingContext: "SEO, LinkedIn et Google Ads. Budget 8 k€/mois, CPL 42 €, campagnes et contenu hebdomadaires, conversion lead 4,5 %, attribution via UTM, cible PME B2B 10-100 salariés.",
  hrContext: "12 salariés organisés en 3 pôles avec 2 managers. 4 recrutements par an, onboarding sur 10 jours, surcharge de 6 h/semaine côté commercial, congés et entretiens gérés dans Lucca, turnover 9 %, principal irritant : préparation manuelle des arrivées.",
  operationsContext: "Processus critiques : livraison de missions et support. 45 dossiers/mois et 120 tickets/mois, coordination par réunion hebdomadaire, délai cible 48 h, contrôle qualité avant livraison, blocage principal sur validation dirigeant, passages entre Notion, Slack et email.",
};
const declaredOnly = compute(completeDeclaredCompany, { tools: ["HubSpot", "Pennylane", "Slack", "Notion", "Lucca"] });
for (const key of ["finance", "accounting", "sales", "marketing", "hr", "operations"]) {
  assert.equal(sectionScore(declaredOnly, key), 60, `${key} doit être à 60 % quand toutes ses dimensions déclaratives sont couvertes`);
}
assert.ok(declaredOnly.overall >= 70, `profil complet déclaré attendu >=70, obtenu ${declaredOnly.overall}`);

// 8. Des faits répétés sur une seule dimension ne gonflent pas la preuve ; des dimensions distinctes oui.
const repeatedFacts: KnowledgeModelInput["facts"] = Array.from({ length: 8 }, (_, index) => ({
  predicate: "hr_onboarding",
  sourceProvider: "lucca",
  sourceRef: `test:onboarding:${index}`,
  valueJson: "10 jours",
  observedAt: NOW,
}));
const hrRepeated = compute(completeDeclaredCompany, {
  tools: ["Lucca"],
  connections: [{ provider: "lucca", accountLabel: "RH", lastSyncedAt: NOW }],
  facts: repeatedFacts,
});
assert.ok(sectionScore(hrRepeated, "hr") < 90, "répéter une seule preuve RH ne doit pas suffire à dépasser 90 %");

const observedFacts: KnowledgeModelInput["facts"] = [];
for (const domain of ["finance", "accounting", "sales", "marketing", "hr", "operations"] as const) {
  for (const dimension of KNOWLEDGE_DIMENSIONS[domain]) {
    observedFacts.push({
      predicate: `${domain}_${dimension.key}_${dimension.keywords[0]}`,
      sourceProvider: `${domain}-connector`,
      sourceRef: `test:${domain}:${dimension.key}`,
      valueJson: dimension.keywords[0],
      observedAt: NOW,
    });
  }
}
const connections = [
  { provider: "stripe", accountLabel: "Finance", lastSyncedAt: NOW },
  { provider: "pennylane", accountLabel: "Comptabilité", lastSyncedAt: NOW },
  { provider: "hubspot", accountLabel: "CRM commercial", lastSyncedAt: NOW },
  { provider: "mailchimp", accountLabel: "Marketing", lastSyncedAt: NOW },
  { provider: "lucca", accountLabel: "RH", lastSyncedAt: NOW },
  { provider: "notion", accountLabel: "Process opérations", lastSyncedAt: NOW },
];
const observed = compute(completeDeclaredCompany, {
  tools: ["HubSpot", "Pennylane", "Slack", "Notion", "Lucca"],
  connections,
  facts: observedFacts,
});
for (const key of ["finance", "accounting", "sales", "marketing", "hr", "operations"]) {
  assert.ok(sectionScore(observed, key) >= 90, `${key} doit dépasser 90 % avec dimensions observées + connexion`);
}

// 9. Une donnée ancienne perd du poids et Pilotzia demande à la reconfirmer.
const staleDates = freshDates();
staleDates.hr = "2025-12-01T12:00:00.000Z";
const stale = compute(completeDeclaredCompany, { tools: ["Lucca"], sectionUpdatedAt: staleDates });
const staleHr = stale.sections.find((section) => section.key === "hr");
assert.equal(staleHr?.freshness, "stale");
assert.ok((staleHr?.score ?? 100) < 60);
assert.match(stale.guidanceSteps.find((step) => step.sectionKey === "hr")?.action ?? "", /évolué|confirmer|actual/i);

// 10. Le professionnel retrouve un résumé modifiable de chacune des 12 rubriques.
const summaries = buildCompanyProfileSummary({ ...completeDeclaredCompany, tools: [{ name: "HubSpot" }, { name: "Pennylane" }] });
assert.equal(summaries.length, 12);
assert.ok(summaries.every((item) => item.filled));
assert.match(summaries.find((item) => item.key === "hr")?.summary ?? "", /12 salariés/i);
assert.equal(summaries.find((item) => item.key === "hr")?.href, "/app/company#hr");
assert.match(summaries.find((item) => item.key === "applications")?.summary ?? "", /HubSpot/);

console.log("✓ 10 scénarios de connaissance entreprise validés");
console.log(`✓ Profil déclaré sémantiquement complet : ${declaredOnly.overall}%`);
console.log(`✓ Profil déclaré + sources/faits distincts : ${observed.overall}%`);
