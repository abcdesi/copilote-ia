import assert from "node:assert/strict";
import { normalizeCompanySize } from "../lib/companies/company-size";
import { PLAN_DEFINITIONS } from "../lib/billing/plans";
import { canApproveRisk, hasCompanyPermission } from "../lib/companies/access";
import { KNOWN_TOOLS } from "../lib/automations/types";
import { getIntegrationDefinition } from "../lib/integrations/registry";
import { mentionedAutomationTemplateIds } from "../lib/automations/recommendation-match";
import { AUTOMATION_CATALOG } from "../lib/automations/catalog";
import { findRecommendedTemplateMatch } from "../lib/ai/advisor-policy";
import { isRealExecutionTemplate } from "../lib/n8n/real-execution-config";
import { BUSINESS_TERRITORIES } from "../lib/companies/territories";

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
  for (const tool of ["Google Analytics 4", "Google Ads", "Meta Ads", "LinkedIn Ads"]) {
    assert.ok(KNOWN_TOOLS.includes(tool as (typeof KNOWN_TOOLS)[number]), `${tool} doit pouvoir être renseigné.`);
    const definition = getIntegrationDefinition(tool);
    assert.equal(definition.mvpPriority, "next", `${tool} ne doit pas être présenté comme un connecteur live.`);
    assert.equal(definition.permissionMode, "read_only", `${tool} doit commencer en lecture seule.`);
  }
}

function testCopilotRecommendationActions() {
  const ids = mentionedAutomationTemplateIds(
    "Je regarderais d'abord ces trois zones, dans cet ordre : 1. **Onboarding automatique des nouveaux clients** — priorité haute. 2. **Réponses automatiques aux questions fréquentes** — priorité moyenne. 3. **Synchronisation CRM et facturation** — priorité moyenne."
  );
  assert.deepEqual(ids, [
    "onboarding-clients",
    "reponses-questions-frequentes",
    "sync-crm-facturation",
  ]);
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
  testCopilotRecommendationActions();
  testSolopreneur();
  testCopilotRecommendationGovernance();
  console.log("Four-profile product acceptance tests: OK");
}

main();
