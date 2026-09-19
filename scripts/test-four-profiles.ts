import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeCompanySize } from "../lib/companies/company-size";
import { PLAN_DEFINITIONS } from "../lib/billing/plans";
import { canApproveRisk, hasCompanyPermission } from "../lib/companies/access";
import { KNOWN_TOOLS } from "../lib/automations/types";
import { getIntegrationDefinition, INTEGRATION_DEFINITIONS } from "../lib/integrations/registry";
import {
  CUSTOMER_MANAGED_INTEGRATION_POLICY,
  normalizeIntegrationConnectionState,
} from "../lib/integrations/connection-framework";
import { BUSINESS_TERRITORY_GROUPS, BUSINESS_TERRITORIES } from "../lib/companies/territories";
import { mentionedAutomationTemplateIds } from "../lib/automations/recommendation-match";
import { AUTOMATION_CATALOG } from "../lib/automations/catalog";
import { findRecommendedTemplateMatch } from "../lib/ai/advisor-policy";
import { extractAnthropicText } from "../lib/ai/anthropic-response";
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

function testFinancialManager() {
  assert.equal(hasCompanyPermission("admin", "view"), true);
  assert.equal(hasCompanyPermission("admin", "manage_documents"), true);
  assert.equal(hasCompanyPermission("admin", "manage_billing"), false, "Le DAF admin ne doit pas pouvoir gérer l'abonnement.");
  assert.ok(
    PLAN_DEFINITIONS.business.features.some((feature) => /audit|intelligence financière/i.test(feature)),
    "Le profil DAF doit être couvert par la profondeur financière de Scale."
  );
}

function testLiveBusinessOutcomeConnectors() {
  const hubspot = getIntegrationDefinition("HubSpot");
  const stripe = getIntegrationDefinition("Stripe");
  assert.equal(hubspot.mvpPriority, "now", "HubSpot doit être présenté comme connecteur live pour les outcomes commerciaux.");
  assert.equal(hubspot.permissionMode, "read_only");
  assert.equal(stripe.mvpPriority, "now", "Stripe métier doit être présenté comme connecteur live pour les factures payées.");
  assert.equal(stripe.permissionMode, "read_only");
}

function testCustomerManagedIntegrationFramework() {
  assert.equal(CUSTOMER_MANAGED_INTEGRATION_POLICY.accountOwnership, "customer_managed");
  assert.equal(CUSTOMER_MANAGED_INTEGRATION_POLICY.subscriptionOwner, "customer");

  for (const definition of INTEGRATION_DEFINITIONS) {
    assert.equal(
      definition.accountOwnership,
      "customer_managed",
      `${definition.name} doit toujours utiliser le compte détenu par l'entreprise cliente.`
    );
    assert.equal(
      definition.subscriptionOwner,
      "customer",
      `Pilotzia ne doit jamais porter l'abonnement fournisseur de ${definition.name}.`
    );
  }

  assert.equal(getIntegrationDefinition("HubSpot").authMode, "oauth");
  assert.equal(getIntegrationDefinition("Stripe").authMode, "signed_webhook");
  assert.equal(getIntegrationDefinition("Slack").authMode, "oauth");
  assert.equal(getIntegrationDefinition("Outil futur").accountOwnership, "customer_managed");
  assert.equal(getIntegrationDefinition("Outil futur").subscriptionOwner, "customer");

  assert.equal(normalizeIntegrationConnectionState(null), "not_connected");
  assert.equal(normalizeIntegrationConnectionState({ status: "connected" }), "connected");
  assert.equal(
    normalizeIntegrationConnectionState({ status: "connected", lastError: "sync failed" }),
    "degraded"
  );
  assert.equal(normalizeIntegrationConnectionState({ status: "needs_reauth" }), "needs_reauth");
  assert.equal(
    normalizeIntegrationConnectionState({ status: "connected" }, { requirementsSatisfied: false }),
    "needs_reauth"
  );

  const toolsPage = readFileSync("app/app/tools/page.tsx", "utf-8");
  assert.ok(
    toolsPage.includes("Vos outils, vos comptes, vos abonnements") &&
      toolsPage.includes("Pilotzia ne souscrit jamais HubSpot") &&
      toolsPage.includes("Compte et abonnement fournisseur : gérés par votre entreprise"),
    "L'interface doit expliquer clairement que les comptes et abonnements fournisseurs restent ceux du client."
  );
}

function testSalesManager() {
  assert.equal(hasCompanyPermission("operator", "view"), true);
  assert.equal(hasCompanyPermission("operator", "manage_contacts"), true);
  assert.equal(hasCompanyPermission("operator", "operate_automations"), true);
  assert.equal(hasCompanyPermission("operator", "configure_automations"), false);
  assert.equal(hasCompanyPermission("operator", "manage_billing"), false);
  assert.equal(canApproveRisk("operator", "low"), true, "Le commercial doit pouvoir valider une action faible risque.");
  assert.equal(canApproveRisk("operator", "medium"), false, "Le risque moyen doit être escaladé vers un admin ou propriétaire.");
  assert.equal(canApproveRisk("operator", "high"), false);
}

function testOperationsManager() {
  assert.equal(hasCompanyPermission("admin", "operate_automations"), true);
  assert.equal(hasCompanyPermission("admin", "configure_automations"), true);
  assert.equal(hasCompanyPermission("admin", "manage_team"), true);
  assert.equal(hasCompanyPermission("admin", "manage_billing"), false, "Le COO ne doit pas pouvoir modifier la facturation.");
  assert.equal(canApproveRisk("admin", "low"), true);
  assert.equal(canApproveRisk("admin", "medium"), true);
  assert.equal(canApproveRisk("admin", "high"), false, "Le risque élevé doit rester réservé au propriétaire.");
  assert.equal(canApproveRisk("admin", "critical"), false, "Le risque critique doit rester réservé au propriétaire.");
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

function testGoogleAdsV25AccessModel() {
  const source = readFileSync("lib/integrations/google-marketing.ts", "utf-8");
  const marketingPage = readFileSync("app/app/marketing/page.tsx", "utf-8");
  const envExample = readFileSync(".env.example", "utf-8");

  assert.ok(
    source.includes('const GOOGLE_ADS_API_VERSION = "v25"'),
    "Google Ads doit utiliser l'API REST v25."
  );
  assert.ok(
    !source.includes("GOOGLE_ADS_DEVELOPER_TOKEN") && !source.includes('"developer-token"'),
    "Google Ads ne doit plus dépendre du developer token supprimé par Google."
  );
  assert.ok(
    !marketingPage.includes("Developer token serveur manquant"),
    "L'interface Marketing ne doit plus présenter le developer token comme un prérequis."
  );
  assert.ok(
    !envExample.includes("GOOGLE_ADS_DEVELOPER_TOKEN") && envExample.includes("Google Ads API Overview"),
    "La configuration doit documenter l'accès porté par le projet Google Cloud."
  );
}

function testProfileGuideCanCollapseAndMove() {
  const source = readFileSync("components/company/ProfileCompletionGuide.tsx", "utf-8");
  assert.ok(source.includes("Réduire la fenêtre"), "Le guide profil doit pouvoir être réduit.");
  assert.ok(source.includes("Déplacer la fenêtre"), "Le guide profil doit pouvoir être déplacé.");
  assert.ok(source.includes("onPointerMove={drag}"), "Le déplacement doit fonctionner à la souris ou au pointeur.");
}

function testAutomaticValueProofLoop() {
  const observe = readFileSync("lib/integrations/observe.ts", "utf-8");
  const providerOutcomes = readFileSync("lib/automations/provider-outcomes.ts", "utf-8");
  const providerOutcomeRoute = readFileSync("app/api/automation-engine/outcomes/provider/route.ts", "utf-8");
  const hubspotWebhook = readFileSync("app/api/integrations/hubspot/webhook/route.ts", "utf-8");
  const stripeWebhook = readFileSync("app/api/integrations/stripe-business/webhook/[companyId]/route.ts", "utf-8");
  const providerWorkflows = readFileSync("lib/n8n/provider-outcome-workflows.ts", "utf-8");
  const results = readFileSync("app/app/results/page.tsx", "utf-8");

  assert.ok(
    observe.includes("observeProspectReplies") &&
      observe.includes("prospectRepliesObserved") &&
      observe.includes("observeProspectMeetings") &&
      observe.includes("prospectMeetingsObserved"),
    "La synchronisation Google doit observer les réponses prospects et les rendez-vous Calendar sans inventer de résultats."
  );
  assert.ok(
    providerOutcomes.includes('"provider_observed"') &&
      providerOutcomes.includes('"AUTOMATION_PROVIDER_OUTCOME_OBSERVED"') &&
      providerOutcomes.includes('"reply_observed"') &&
      providerOutcomes.includes('"meeting_booked"') &&
      providerOutcomes.includes('"temporal_after_pilotzia_follow_up"') &&
      providerOutcomes.includes('"deal_won"') &&
      providerOutcomes.includes('"payment_received"') &&
      providerOutcomes.includes('"authenticated_n8n_callback"'),
    "Les réponses, rendez-vous, deals et encaissements fournisseur doivent produire des preuves traçables avec une attribution explicite."
  );
  assert.ok(
    providerOutcomeRoute.includes("verifyN8nCallback") &&
      providerOutcomeRoute.includes('z.enum(["hubspot", "stripe"])') &&
      providerOutcomeRoute.includes('z.enum(["deal_won", "payment_received"])'),
    "Les résultats CRM et paiement doivent entrer uniquement par un callback n8n authentifié et borné."
  );
  assert.ok(
    hubspotWebhook.includes("verifyHubSpotWebhookSignatureV3") &&
      hubspotWebhook.includes("hs_is_closed_won") &&
      hubspotWebhook.includes('triggerProviderOutcomeRelay("hubspot"'),
    "Un deal gagné HubSpot doit être signé, résolu puis relayé par n8n avant d'être compté."
  );
  assert.ok(
    stripeWebhook.includes("verifyStripeWebhookSignature") &&
      stripeWebhook.includes('"invoice.paid"') &&
      stripeWebhook.includes('"relance-factures"') &&
      stripeWebhook.includes('triggerProviderOutcomeRelay("stripe"'),
    "Un encaissement Stripe métier doit venir d'un invoice.paid signé et d'une relance facture attribuable."
  );
  assert.ok(
    providerWorkflows.includes("PILOTZIA_PROVIDER_OUTCOME_RELAY_V1") &&
      providerWorkflows.includes("ensureProviderOutcomeRelayWorkflow") &&
      providerWorkflows.includes("/api/automation-engine/outcomes/provider"),
    "Les observations HubSpot et Stripe doivent traverser des workflows n8n publiés et authentifiés."
  );
  assert.ok(
    results.includes("Chaîne de preuve opérationnelle") &&
      results.includes("1 · Détecter") &&
      results.includes("4 · Mesurer") &&
      results.includes("Résultat métier à mesurer") &&
      results.includes("Encaissements observés"),
    "Résultats doit matérialiser la boucle détection → décision → action → mesure sans confondre exécution et valeur."
  );
}

function testCoreViewsPreserveUiAndFailSoft() {
  const automations = readFileSync("app/app/automations/page.tsx", "utf-8");
  const opportunities = readFileSync("app/app/opportunities/page.tsx", "utf-8");
  const results = readFileSync("app/app/results/page.tsx", "utf-8");

  for (const [name, source] of [
    ["automations", automations],
    ["opportunities", opportunities],
    ["results", results],
  ] as const) {
    assert.ok(source.includes(".catch((error) =>"), `${name} doit rester affichable si une source historique échoue.`);
  }

  assert.ok(automations.includes("<AutomationCard"), "La présentation Automatisations doit rester inchangée.");
  assert.ok(opportunities.includes("<OpportunityCard"), "La présentation Opportunités doit rester inchangée.");
  assert.ok(results.includes("Résultats constatés ou déclarés"), "Le contenu Résultats doit rester inchangé.");
}

function testDashboardViewsAreFailSoft() {
  const pages = [
    "app/app/actions/page.tsx",
    "app/app/support/page.tsx",
    "app/app/context/page.tsx",
    "app/app/copilot/page.tsx",
    "app/app/copilot/history/page.tsx",
    "app/app/finance/page.tsx",
    "app/app/team/page.tsx",
    "app/app/tools/page.tsx",
    "app/app/marketing/page.tsx",
    "app/app/settings/page.tsx",
    "app/app/company/page.tsx",
    "app/app/company/history/page.tsx",
    "app/app/automations/[id]/page.tsx",
    "app/app/opportunities/[id]/page.tsx",
    "app/app/admin/intelligence/page.tsx",
    "app/app/admin/support/page.tsx",
  ];

  for (const page of pages) {
    const source = readFileSync(page, "utf-8");
    assert.ok(
      source.includes("safeRead") || source.includes(".catch((error) =>"),
      `${page} doit isoler ses lectures fragiles au lieu de faire tomber toute la vue.`
    );
  }

  const company = readFileSync("app/app/company/page.tsx", "utf-8");
  assert.ok(
    company.includes("getDashboardShellAccess") && company.includes("company.core") && company.includes("company.domains"),
    "Mon entreprise doit charger les groupes de données indépendamment pour conserver l'interface si une colonne historique pose problème."
  );

  const automationDetail = readFileSync("app/app/automations/[id]/page.tsx", "utf-8");
  assert.ok(
    automationDetail.includes("automation-detail.core") && automationDetail.includes("automation-detail.governance"),
    "Le détail d'une automatisation doit séparer le cœur historique des champs de gouvernance plus récents."
  );
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
  const chatView = readFileSync("components/dashboard/ChatView.tsx", "utf-8");

  assert.ok(
    source.includes('fetch("/api/chat"'),
    "La barre haute doit pouvoir afficher un aperçu court de la réponse."
  );
  assert.ok(
    source.includes("line-clamp-2") && source.includes("compactPreview"),
    "L'aperçu du Copilote doit rester limité à une ou deux lignes."
  );
  assert.ok(
    source.includes("<span>{reply}</span>") && source.includes("Continuer à lire dans Copilote"),
    "Le lien vers le Copilote doit apparaître juste après le texte de réponse."
  );
  assert.ok(
    chatView.includes("<RichMessage content={m.content} />") && !chatView.includes("compactPreview"),
    "Dans la page Copilote, la réponse complète doit être rendue sans compactage ni line-clamp."
  );

  const complete = extractAnthropicText([
    { type: "thinking", thinking: "raisonnement interne" },
    { type: "text", text: "Première partie de la réponse. " },
    { type: "text", text: "Deuxième partie, qui doit rester visible." },
  ]);
  assert.equal(
    complete,
    "Première partie de la réponse. Deuxième partie, qui doit rester visible.",
    "Pilotzia doit recomposer tous les blocs texte renvoyés par le fournisseur avant d'enregistrer la réponse."
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
  assert.equal(PLAN_DEFINITIONS.starter.monthlyAutomationPurchaseLimit, 2);
  assert.ok(
    PLAN_DEFINITIONS.starter.features.some((feature) => /2 nouvelles automatisations par mois/i.test(feature)),
    "Core doit permettre explicitement jusqu'à 2 nouvelles automatisations mensuelles achetées à l'unité."
  );
  assert.equal(PLAN_DEFINITIONS.pro.monthlyAutomationPurchaseLimit, null);
  assert.equal(hasCompanyPermission("owner", "view"), true);
  assert.equal(hasCompanyPermission("owner", "edit_company"), true);
}

function main() {
  testDemandingExecutive();
  testSixtyEmployeeCompany();
  testOperationsManager();
  testFinancialManager();
  testSalesManager();
  testLiveBusinessOutcomeConnectors();
  testCustomerManagedIntegrationFramework();
  testMarketingExpert();
  testGoogleAdsV25AccessModel();
  testAutomaticValueProofLoop();
  testProfileGuideCanCollapseAndMove();
  testCoreViewsPreserveUiAndFailSoft();
  testDashboardViewsAreFailSoft();
  testLegacyCompanyAccessCompatibility();
  testCopilotTopBarHandoff();
  testCopilotRecommendationActions();
  testTerritoriesAndCopilotAutomationProposals();
  testSolopreneur();
  testCopilotRecommendationGovernance();
  console.log("Seven-profile product acceptance tests: OK");
}

main();
