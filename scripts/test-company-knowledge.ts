import assert from "node:assert/strict";
import { computeCompanyKnowledgeCoverage, knowledgeIntentMatches, type KnowledgeModelInput } from "../lib/companies/knowledge-model";
import { buildCompanyProfileSummary } from "../lib/companies/profile-summary";

const detailed = (label: string) => Array.from({ length: 75 }, (_, index) => `${label}${index + 1}`).join(" ");

function baseCompany(): KnowledgeModelInput["company"] {
  return {
    industry: "Conseil B2B",
    country: "France",
    sizeRange: "6-20",
    employeeCount: 12,
    objectives: detailed("objectif"),
    painPoints: detailed("irritant"),
    businessModel: detailed("modele"),
    customerProfile: detailed("client"),
    localContext: detailed("local"),
    financeContext: null,
    marketingContext: null,
    accountingContext: null,
    salesContext: null,
    hrContext: detailed("rh"),
    operationsContext: null,
  };
}

function sectionScore(result: ReturnType<typeof computeCompanyKnowledgeCoverage>, key: string) {
  return result.sections.find((section) => section.key === key)?.score ?? -1;
}

// 1. Entreprise vide : le système reste prudent et donne un premier palier clair.
const empty = computeCompanyKnowledgeCoverage({
  company: {
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
  },
  tools: [],
  connections: [],
  facts: [],
});
assert.equal(empty.overall, 0);
assert.equal(empty.nextMilestone?.score, 35);
assert.ok(empty.guidanceSteps.length > 0);

// 2. Le mot court "CA" ne doit plus être détecté à l'intérieur de "blocages".
assert.equal(knowledgeIntentMatches("réduire les blocages et les délais", "ca"), false);
assert.equal(knowledgeIntentMatches("augmenter le CA de 15 %", "ca"), true);
assert.equal(knowledgeIntentMatches("factures impayées", "factur"), true);

// 3. Un enjeu temps/blocage priorise les opérations, sans faux positif commercial.
const operationsCompany = baseCompany();
operationsCompany.objectives = "Réduire fortement les délais opérationnels et le temps perdu chaque semaine grâce à des processus plus fluides.";
operationsCompany.painPoints = "Nous avons des blocages récurrents en production, des réunions trop longues et des délais de support qui augmentent.";
const operations = computeCompanyKnowledgeCoverage({ company: operationsCompany, tools: ["Slack", "Notion", "Gmail", "Calendar"], connections: [], facts: [] });
assert.equal(operations.guidanceSteps[0]?.sectionKey, "operations");
assert.notEqual(operations.guidanceSteps[0]?.sectionKey, "sales");
assert.equal(operations.nextSection?.key, "operations");

// 4. Un objectif revenu/prospection priorise le commercial.
const salesCompany = baseCompany();
salesCompany.objectives = "Augmenter le CA de 20 % sur 90 jours et améliorer la conversion du pipeline commercial.";
salesCompany.painPoints = "Les prospects répondent peu, les devis sont relancés tardivement et plusieurs leads restent sans suivi.";
const sales = computeCompanyKnowledgeCoverage({ company: salesCompany, tools: ["HubSpot", "Gmail", "Slack", "Notion"], connections: [], facts: [] });
assert.equal(sales.guidanceSteps[0]?.sectionKey, "sales");
assert.equal(sales.nextSection?.key, "sales");

// 5. Un enjeu marge/trésorerie priorise la finance.
const financeCompany = baseCompany();
financeCompany.objectives = "Améliorer la marge et la trésorerie sur les trois prochains mois tout en réduisant les coûts récurrents.";
financeCompany.painPoints = "La visibilité cash est insuffisante et les créances clients pèsent sur la trésorerie.";
const finance = computeCompanyKnowledgeCoverage({ company: financeCompany, tools: ["Pennylane", "Stripe", "Gmail", "Notion"], connections: [], facts: [] });
assert.equal(finance.guidanceSteps[0]?.sectionKey, "finance");

// 6. Entreprise qui remplit toutes les rubriques : les déclarations montent réellement le score,
// mais ne simulent pas une preuve connectée. Les domaines métier plafonnent alors à 60 %.
const completeDeclaredCompany = {
  ...baseCompany(),
  financeContext: detailed("finance"),
  accountingContext: detailed("compta"),
  salesContext: detailed("vente"),
  marketingContext: detailed("marketing"),
  hrContext: detailed("rh"),
  operationsContext: detailed("operation"),
};
const declaredOnly = computeCompanyKnowledgeCoverage({
  company: completeDeclaredCompany,
  tools: ["HubSpot", "Pennylane", "Slack", "Notion"],
  connections: [],
  facts: [],
});
for (const key of ["finance", "accounting", "sales", "marketing", "hr", "operations"]) {
  assert.equal(sectionScore(declaredOnly, key), 60, `${key} doit être à 60 % avec déclaration riche seule`);
}
assert.equal(declaredOnly.overall, 78);
assert.equal(declaredOnly.nextMilestone?.score, 80);
assert.match(declaredOnly.guidanceSteps.find((step) => step.sectionKey === "finance")?.action ?? "", /source connectée|faits chiffrés/i);

// 7. Les mêmes rubriques, enrichies de sources et de faits structurés, passent au niveau avancé.
const connections = [
  { provider: "stripe", accountLabel: "Finance" },
  { provider: "pennylane", accountLabel: "Comptabilité" },
  { provider: "hubspot", accountLabel: "CRM commercial" },
  { provider: "mailchimp", accountLabel: "Marketing" },
  { provider: "lucca", accountLabel: "RH" },
  { provider: "notion", accountLabel: "Process opérations" },
];
const facts: KnowledgeModelInput["facts"] = [];
for (const [predicate, provider] of [
  ["finance_margin", "stripe"],
  ["accounting_invoice", "pennylane"],
  ["sales_pipeline", "hubspot"],
  ["marketing_campaign", "mailchimp"],
  ["hr_recruitment", "lucca"],
  ["operations_process", "notion"],
] as const) {
  for (let index = 0; index < 4; index += 1) {
    facts.push({ predicate, sourceProvider: provider, sourceRef: `test:${predicate}:${index}`, valueJson: String(index + 1) });
  }
}
const observed = computeCompanyKnowledgeCoverage({
  company: completeDeclaredCompany,
  tools: ["HubSpot", "Pennylane", "Slack", "Notion"],
  connections,
  facts,
});
assert.ok(observed.overall >= 90, `score avancé attendu, obtenu ${observed.overall}`);
for (const key of ["finance", "accounting", "sales", "marketing", "hr", "operations"]) {
  assert.ok(sectionScore(observed, key) >= 90, `${key} doit dépasser 90 % avec faits + connexion`);
}

// 8. Le professionnel retrouve un résumé modifiable de chacune des 12 rubriques.
const summaries = buildCompanyProfileSummary({ ...completeDeclaredCompany, tools: [{ name: "HubSpot" }, { name: "Pennylane" }] });
assert.equal(summaries.length, 12);
assert.ok(summaries.every((item) => item.filled));
assert.match(summaries.find((item) => item.key === "hr")?.summary ?? "", /rh1/i);
assert.equal(summaries.find((item) => item.key === "hr")?.href, "/app/company#hr");
assert.match(summaries.find((item) => item.key === "applications")?.summary ?? "", /HubSpot/);

console.log("✓ 8 scénarios de connaissance entreprise validés");
console.log(`✓ Profil entièrement déclaré : ${declaredOnly.overall}% (sans inventer de preuve connectée)`);
console.log(`✓ Profil déclaré + sources/faits : ${observed.overall}%`);
