import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCompanySize } from "../lib/companies/company-size";
import { PLAN_DEFINITIONS } from "../lib/billing/plans";
import { canApproveRisk, hasCompanyPermission } from "../lib/companies/access";
import { KNOWN_TOOLS } from "../lib/automations/types";
import { getIntegrationDefinition } from "../lib/integrations/registry";
import { BUSINESS_TERRITORY_GROUPS, BUSINESS_TERRITORIES } from "../lib/companies/territories";
import { mentionedAutomationTemplateIds } from "../lib/automations/recommendation-match";
import { AUTOMATION_CATALOG } from "../lib/automations/catalog";
import { findRecommendedTemplateMatch } from "../lib/ai/advisor-policy";
import { isRealExecutionTemplate } from "../lib/n8n/real-execution-config";
import { deriveMarketingKpis } from "../lib/marketing/kpis";

function testDemandingExecutive() {
  assert.equal(canApproveRisk("owner", "critical"), true, "Le propriétaire doit pouvoir valider le risque critique.");
  assert.ok(AUTOMATION_CATALOG.every((template) => template.priceEur > 0), "Chaque automatisation catalogue doit conserver un prix d'achat unique.");
  assert.equal(hasCompanyPermission("owner", "manage_billing"), true);
  assert.equal(hasCompanyPermission("owner", "manage_team"), true);
  assert.ok(
    PLAN_DEFINITIONS.business.features.some((feature) => /audit|intelligence financière/i.test(feature)),
    "Scale doit exposer explicitement la profondeur d'audit."
  );
}

function testSixtyEmployeeCompany() {
  assert.equal(normalizeCompanySize({ employeeCount: 60, sizeRange: "6-20" }), "51-200");
  assert.equal(PLAN_DEFINITIONS.business.includedSeats, 10);
  assert.ok(
    PLAN_DEFINITIONS.pro.features.some((feature) => /achetées à l'unité/i.test(feature)),
    "Action doit donner accès au moteur sans faire croire que les automatisations sont gratuites."
  );
  assert.equal(hasCompanyPermission("admin", "manage_team"), true);
  assert.equal(hasCompanyPermission("admin", "manage_billing"), false, "La facturation reste propriétaire.");
  assert.equal(canApproveRisk("admin", "high"), false, "Le risque élevé reste propriétaire.");
  assert.equal(hasCompanyPermission("operator", "operate_automations"), true);
  assert.equal(hasCompanyPermission("operator", "configure_automations"), false);
  assert.equal(hasCompanyPermission("viewer", "view"), true);
  assert.equal(hasCompanyPermission("viewer", "operate_automations"), false);
}

function testCopilotRecommendationGovernance() {
  const recommended = findRecommendedTemplateMatch(
    "Je recommande de commencer par automatiser la relance des prospects silencieux.",
    AUTOMATION_CATALOG,
    ["Gmail"]
  );
  assert.equal(recommended?.id, "relance-prospects");

  const mereMention = findRecommendedTemplateMatch(
    "Vous utilisez Gmail et vous avez des prospects à suivre.",
    AUTOMATION_CATALOG,
    ["Gmail"]
  );
  assert.equal(mereMention, undefined, "Une simple mention ne doit pas créer une automatisation.");

  const ambiguous = findRecommendedTemplateMatch(
    "Je recommande d'automatiser les relances prospects et le reporting hebdomadaire KPI.",
    AUTOMATION_CATALOG,
    ["Gmail", "Google Sheets"]
  );
  assert.equal(ambiguous, undefined, "Pilotzia ne doit pas choisir silencieusement entre plusieurs recommandations.");

  assert.equal(isRealExecutionTemplate("relance-prospects"), true);
  assert.equal(isRealExecutionTemplate("reporting-hebdo"), false);
}

function testMarketingExpert() {
  for (const tool of ["Google Analytics 4", "Google Ads"]) {
    assert.ok(KNOWN_TOOLS.includes(tool as (typeof KNOWN_TOOLS)[number]), `${tool} doit pouvoir être renseigné.`);
    const definition = getIntegrationDefinition(tool);
    assert.equal(definition.mvpPriority, "now", `${tool} doit être présenté comme un connecteur Google disponible.`);
    assert.equal(definition.permissionMode, "read_only", `${tool} doit rester en lecture seule côté Pilotzia.`);
  }

  for (const tool of ["Meta Ads", "LinkedIn Ads"]) {
    assert.ok(KNOWN_TOOLS.includes(tool as (typeof KNOWN_TOOLS)[number]), `${tool} doit pouvoir être renseigné.`);
    const definition = getIntegrationDefinition(tool);
    assert.equal(definition.mvpPriority, "next", `${tool} ne doit pas encore être présenté comme un connecteur live.`);
    assert.equal(definition.permissionMode, "read_only");
  }

  const kpis = deriveMarketingKpis({
    source: "google_marketing",
    observedAt: new Date().toISOString(),
    periodDays: 30,
    spendEur: 1000,
    leads: null,
    conversions: 20,
    customers: null,
    revenueEur: 5000,
    attributedRevenueEur: 4000,
    sessions: 10000,
    users: 7000,
    clicks: 500,
    impressions: 10000,
    currencyCode: "EUR",
    providers: ["ga4", "google_ads"],
  });
  assert.equal(kpis.roas, 4, "Le ROAS doit utiliser la valeur de conversion Google Ads attribuée.");
  assert.equal(kpis.cpaEur, 50);
  assert.equal(kpis.costPerClickEur, 2);
  assert.equal(kpis.clickThroughRate, 5);
}

function testLegacyCompanyAccessCompatibility() {
  const current = readFileSync("lib/companies/current.ts", "utf-8");
  const access = readFileSync("lib/companies/access.ts", "utf-8");

  assert.ok(
    current.includes("getDashboardShellAccess") && !current.includes("getCurrentCompanyAccess"),
    "Les pages simples doivent utiliser l'accès minimal qui fonctionne aussi pour les comptes historiques."
  );
  assert.ok(
    access.includes("const shell = await getDashboardShellAccess()"),
    "L'accès enrichi doit partir de l'entreprise résolue par le shell sans recréer un membership à chaque page."
  );
}

function testCopilotTopBarHandoff() {
  const source = readFileSync("components/dashboard/CopilotBar.tsx", "utf-8");
  assert.ok(
    !source.includes('fetch("/api/chat"'),
    "La barre haute ne doit jamais appeler le chat ni injecter une réponse longue dans la page courante."
  );
  assert.ok(
    source.includes("pilotzia:copilot-draft"),
    "La barre haute doit transmettre le prompt au Copilote complet."
  );
  assert.ok(
    source.includes("Continuer à lire dans Copilote"),
    "La barre haute doit conserver le lien explicite vers le Copilote."
  );
}

function testCopilotRecommendationActions() {
  const ids = mentionedAutomationTemplateIds(
    "Je regarderais d'abord ces trois zones, dans cet ordre : 1. **Onboarding automatique des nouveaux clients** — priorité haute. 2. **Réponses automatiques aux questions fréquentes** — priorité moyenne. 3. **Synchronisation CRM et facturation** — priorité moyenne."
  );
  assert.deepEqual(ids, [
    "onboarding-clients",
    "support-questions-frequentes",
    "sync-crm-facturation",
  ]);
}

function testTerritoriesAndCopilotAutomationProposals() {
  for (const territory of [
    "France métropolitaine",
    "Martinique",
    "Guadeloupe",
    "Guyane",
    "La Réunion",
    "Mayotte",
    "Saint-Martin",
    "Saint-Barthélemy",
    "Saint-Pierre-et-Miquelon",
    "Polynésie française",
    "Nouvelle-Calédonie",
    "Wallis-et-Futuna",
  ]) {
    assert.ok(BUSINESS_TERRITORIES.includes(territory as (typeof BUSINESS_TERRITORIES)[number]), `${territory} doit être sélectionnable individuellement à l'inscription.`);
  }
  assert.ok(
    BUSINESS_TERRITORY_GROUPS.some((group) => group.label === "Outre-mer français"),
    "Les territoires ultramarins doivent être regroupés sous un libellé Outre-mer français clair."
  );

  const prospectMatches = mentionedAutomationTemplateIds(
    "Je vous recommande de mettre en place une relance automatique des prospects qui ne répondent plus depuis plusieurs jours."
  );
  assert.ok(prospectMatches.includes("relance-prospects"), "Une recommandation de relance prospects doit proposer l'automatisation correspondante.");

  const reportingMatches = mentionedAutomationTemplateIds(
    "Il faudrait automatiser un reporting chaque semaine pour réunir les KPI marketing et les diffuser à l'équipe."
  );
  assert.ok(reportingMatches.includes("reporting-hebdo"), "Une recommandation de reporting hebdomadaire doit proposer l'automatisation correspondante.");

  const vagueMatches = mentionedAutomationTemplateIds(
    "Votre équipe devrait mieux suivre les clients."
  );
  assert.ok(vagueMatches.length <= 1, "Une recommandation trop vague ne doit pas générer plusieurs automatisations arbitraires.");
}

function testSolopreneur() {
  assert.equal(normalizeCompanySize({ employeeCount: 1, sizeRange: "6-20" }), "1-5");
  for (const territory of ["Martinique", "Guadeloupe", "Guyane", "La Réunion"]) {
    assert.ok(BUSINESS_TERRITORIES.includes(territory as (typeof BUSINESS_TERRITORIES)[number]), `${territory} doit être proposé explicitement à l'inscription.`);
  }
  assert.equal(PLAN_DEFINITIONS.starter.includedSeats, 1);
  assert.equal(PLAN_DEFINITIONS.starter.priceEur, 79);
  assert.equal(hasCompanyPermission("owner", "view"), true);
  assert.equal(hasCompanyPermission("owner", "edit_company"), true);
}

function main() {
  testDemandingExecutive();
  testSixtyEmployeeCompany();
  testMarketingExpert();
  testLegacyCompanyAccessCompatibility();
  testCopilotTopBarHandoff();
  testCopilotRecommendationActions();
  testTerritoriesAndCopilotAutomationProposals();
  testSolopreneur();
  testCopilotRecommendationGovernance();
  console.log("Four-profile product acceptance tests: OK");
}

main();
