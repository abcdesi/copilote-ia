import assert from "node:assert/strict";
import { normalizeCompanySize } from "../lib/companies/company-size";
import { PLAN_DEFINITIONS } from "../lib/billing/plans";
import { canApproveRisk, hasCompanyPermission } from "../lib/companies/access";
import { KNOWN_TOOLS } from "../lib/automations/types";
import { getIntegrationDefinition } from "../lib/integrations/registry";

function testDemandingExecutive() {
  assert.equal(canApproveRisk("owner", "critical"), true, "Le propriétaire doit pouvoir valider le risque critique.");
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
  assert.equal(hasCompanyPermission("admin", "manage_team"), true);
  assert.equal(hasCompanyPermission("admin", "manage_billing"), false, "La facturation reste propriétaire.");
  assert.equal(canApproveRisk("admin", "high"), false, "Le risque élevé reste propriétaire.");
  assert.equal(hasCompanyPermission("operator", "operate_automations"), true);
  assert.equal(hasCompanyPermission("operator", "configure_automations"), false);
  assert.equal(hasCompanyPermission("viewer", "view"), true);
  assert.equal(hasCompanyPermission("viewer", "operate_automations"), false);
}

function testMarketingExpert() {
  for (const tool of ["Google Analytics 4", "Google Ads", "Meta Ads", "LinkedIn Ads"]) {
    assert.ok(KNOWN_TOOLS.includes(tool as (typeof KNOWN_TOOLS)[number]), `${tool} doit pouvoir être renseigné.`);
    const definition = getIntegrationDefinition(tool);
    assert.equal(definition.mvpPriority, "next", `${tool} ne doit pas être présenté comme un connecteur live.`);
    assert.equal(definition.permissionMode, "read_only", `${tool} doit commencer en lecture seule.`);
  }
}

function testSolopreneur() {
  assert.equal(normalizeCompanySize({ employeeCount: 1, sizeRange: "6-20" }), "1-5");
  assert.equal(PLAN_DEFINITIONS.starter.includedSeats, 1);
  assert.equal(PLAN_DEFINITIONS.starter.priceEur, 79);
  assert.equal(hasCompanyPermission("owner", "view"), true);
  assert.equal(hasCompanyPermission("owner", "edit_company"), true);
}

function main() {
  testDemandingExecutive();
  testSixtyEmployeeCompany();
  testMarketingExpert();
  testSolopreneur();
  console.log("Four-profile product acceptance tests: OK");
}

main();
