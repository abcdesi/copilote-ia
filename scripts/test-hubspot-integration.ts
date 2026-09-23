import assert from "node:assert/strict";
import {
  buildHubSpotAuthorizationUrl,
  createHubSpotState,
  getHubSpotConfigurationStatus,
  HUBSPOT_SCOPES,
  verifyHubSpotState,
} from "../lib/integrations/hubspot";
import { getIntegrationDefinition } from "../lib/integrations/registry";
import { mentionedAutomationTemplateIds } from "../lib/automations/recommendation-match";

function main() {
  process.env.APP_URL = "https://pilotzia.example";
  process.env.HUBSPOT_CLIENT_ID = "client-test";
  process.env.HUBSPOT_CLIENT_SECRET = "secret-test";
  process.env.OAUTH_STATE_SECRET = "oauth-state-test-secret-that-is-long-enough";
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

  assert.deepEqual(getHubSpotConfigurationStatus(), { configured: true, missing: [] });

  const state = createHubSpotState("company_test");
  const verified = verifyHubSpotState(state);
  assert.equal(verified.companyId, "company_test");

  assert.throws(() => verifyHubSpotState(state.slice(0, -2) + "xx"));

  const authorization = new URL(buildHubSpotAuthorizationUrl("company_test"));
  assert.equal(authorization.origin, "https://app.hubspot.com");
  assert.equal(authorization.pathname, "/oauth/authorize");
  assert.equal(authorization.searchParams.get("client_id"), "client-test");
  assert.equal(
    authorization.searchParams.get("redirect_uri"),
    "https://pilotzia.example/api/integrations/hubspot/callback"
  );

  const requestedScopes = new Set((authorization.searchParams.get("scope") ?? "").split(" "));
  assert.deepEqual(
    requestedScopes,
    new Set([
      "oauth",
      "crm.objects.contacts.read",
      "crm.objects.companies.read",
      "crm.objects.deals.read",
    ])
  );
  assert.deepEqual(new Set(HUBSPOT_SCOPES), requestedScopes);
  assert.equal([...requestedScopes].some((scope) => scope.endsWith(".write")), false);

  const definition = getIntegrationDefinition("HubSpot");
  assert.equal(definition.mvpPriority, "now");
  assert.equal(definition.permissionMode, "read_only");

  const recommendations = mentionedAutomationTemplateIds(
    "Je recommande de mettre en place une relance automatique des prospects silencieux et de mieux suivre le pipeline commercial."
  );
  assert.ok(
    recommendations.includes("relance-prospects"),
    "Une recommandation explicite de relance doit produire une piste d'automatisation."
  );

  console.log("HubSpot OAuth and Copilot automation-link tests: OK");
}

main();
