import assert from "node:assert/strict";
import type { ChatContext, ChatMessageInput } from "../lib/ai/types";
import { compactExpertEvidence, inferDomainSelection } from "../lib/ai/expert-response-policy";
import { extractBusinessRhythms, getBusinessRhythmReminders } from "../lib/business-graph/rhythms";

const NOW = new Date("2026-08-20T08:00:00.000Z");

function baseContext(overrides: Partial<ChatContext> = {}): ChatContext {
  return {
    companyId: "company-test",
    companyName: "Entreprise Test",
    industry: "Conseil B2B",
    country: "France",
    sizeRange: "6-20",
    objectives: "Améliorer la marge et réduire les délais de réponse.",
    painPoints: "Des validations manuelles créent des retards.",
    businessModel: "Prestations B2B récurrentes.",
    customerProfile: "PME de 10 à 100 salariés.",
    localContext: null,
    domainContexts: {
      finance: null,
      accounting: null,
      sales: null,
      marketing: null,
      hr: null,
      operations: null,
    },
    knowledgeCoverage: {
      overall: 30,
      level: "contextuel",
      sections: ["finance", "accounting", "sales", "marketing", "hr", "operations"].map((key) => ({
        key,
        label: key,
        score: 10,
        freshness: "fresh",
        lastUpdatedAt: NOW.toISOString(),
        dimensions: [],
      })),
    },
    businessRhythms: [],
    tools: [],
    connections: [],
    observations: null,
    businessGraph: null,
    evidence: [],
    automations: [],
    automationScore: 0,
    totalHoursSavedThisMonth: 0,
    totalValueEurThisMonth: 0,
    topOpportunity: null,
    topOpportunities: [],
    ...overrides,
  };
}

function messages(content: string): ChatMessageInput[] {
  return [{ role: "user", content }];
}

// 1. Les récurrences sont normalisées en mémoire compacte, sans conserver le texte brut.
const rhythms = extractBusinessRhythms(
  {
    accountingContext: "Nous préparons le bilan annuel en mars. La clôture mensuelle se fait à J+10.",
    hrContext: "Nos recrutements sont surtout concentrés en septembre et octobre. Entretiens annuels en janvier.",
    marketingContext: "Une campagne forte revient chaque année en novembre.",
  },
  NOW
);
assert.ok(rhythms.some((rhythm) => rhythm.key === "annual_accounts" && rhythm.months.includes(3)));
assert.ok(rhythms.some((rhythm) => rhythm.key === "monthly_close" && rhythm.cadence === "monthly"));
assert.ok(rhythms.some((rhythm) => rhythm.key === "recruitment_period" && rhythm.months.includes(9) && rhythm.months.includes(10)));
assert.ok(rhythms.every((rhythm) => !rhythm.summary.includes("Nous préparons")));

// 2. Le morning brief remonte seulement les rythmes qui approchent assez pour être utiles.
const reminders = getBusinessRhythmReminders(
  {
    accountingContext: "Nous préparons le bilan annuel en mars.",
    hrContext: "Nos recrutements sont surtout concentrés en septembre et octobre.",
  },
  NOW
);
assert.ok(reminders.some((rhythm) => rhythm.key === "recruitment_period"));
assert.ok(!reminders.some((rhythm) => rhythm.key === "annual_accounts"));

// 3. Une question de trésorerie commence en Finance/Compta mais élargit au Commercial si le noyau est pauvre et que des données commerciales existent.
const weakCashContext = baseContext({
  objectives: "Sécuriser la trésorerie.",
  painPoints: "Le cash baisse depuis deux mois.",
  domainContexts: {
    finance: null,
    accounting: null,
    sales: "Le pipeline commercial vaut 300 k€, les devis sont relancés tardivement et le cycle de vente moyen est de 58 jours.",
    marketing: null,
    hr: null,
    operations: null,
  },
  evidence: [
    {
      subject: "CRM",
      predicate: "pipeline_value",
      value: 300000,
      source: "hubspot",
      confidence: 0.95,
      observedAt: "2026-08-19T08:00:00.000Z",
    },
  ],
});
const weakCashSelection = inferDomainSelection(messages("Pourquoi notre trésorerie baisse ?"), weakCashContext);
assert.ok(weakCashSelection.primaryDomains.includes("finance"));
assert.ok(weakCashSelection.primaryDomains.includes("accounting"));
assert.ok(weakCashSelection.expandedDomains.includes("sales"), `expansion attendue vers sales, obtenu ${weakCashSelection.expandedDomains.join(",")}`);

// 4. Avec un noyau Finance/Compta déjà solide, Pilotzia ne charge pas inutilement les autres silos.
const strongCashContext = baseContext({
  domainContexts: {
    finance: "Trésorerie 180 k€, créances 95 k€, marge 31 %, prévision de cash mensuelle.",
    accounting: "Pennylane, clôture mensuelle, relances impayés J+7/J+15, rapprochement hebdomadaire.",
    sales: "Pipeline 300 k€ dans HubSpot.",
    marketing: null,
    hr: null,
    operations: null,
  },
  knowledgeCoverage: {
    overall: 75,
    level: "observé",
    sections: [
      { key: "finance", label: "Finance", score: 85, freshness: "fresh", lastUpdatedAt: NOW.toISOString(), dimensions: [] },
      { key: "accounting", label: "Comptabilité", score: 82, freshness: "fresh", lastUpdatedAt: NOW.toISOString(), dimensions: [] },
      { key: "sales", label: "Commercial", score: 70, freshness: "fresh", lastUpdatedAt: NOW.toISOString(), dimensions: [] },
    ],
  },
  evidence: [
    { subject: "Finance", predicate: "cash_balance", value: 180000, source: "bank", confidence: 0.98, observedAt: "2026-08-19T08:00:00.000Z" },
    { subject: "Compta", predicate: "overdue_receivables", value: 30000, source: "pennylane", confidence: 0.96, observedAt: "2026-08-19T08:00:00.000Z" },
  ],
});
const strongCashSelection = inferDomainSelection(messages("Pourquoi notre trésorerie baisse ?"), strongCashContext);
assert.deepEqual(strongCashSelection.expandedDomains, []);

// 5. Le contexte envoyé au modèle est compact : phrases redondantes éliminées et nombre de preuves borné.
const repeatedSalesText = Array.from({ length: 20 }, () => "Les relances prospects sont faites manuellement et prennent 5 heures par semaine.").join(" ");
const compact = compactExpertEvidence(
  messages("Où gagner du temps dans les relances prospects ?"),
  baseContext({
    domainContexts: { finance: null, accounting: null, sales: repeatedSalesText, marketing: null, hr: null, operations: "Les validations prennent du temps." },
    evidence: Array.from({ length: 25 }, (_, index) => ({
      subject: "CRM",
      predicate: `prospect_followup_${index}`,
      value: index,
      source: "hubspot",
      confidence: 0.9,
      observedAt: "2026-08-19T08:00:00.000Z",
    })),
  })
);
const compactSales = String((compact.domainContexts as Record<string, unknown>).sales ?? "");
assert.ok(compactSales.length <= 700, `contexte commercial trop long: ${compactSales.length}`);
assert.ok((compact.evidence as unknown[]).length <= 10);
assert.equal((compactSales.match(/relances prospects/gi) ?? []).length, 1);

console.log("✓ contexte relationnel : noyau ciblé + élargissement intelligent validé");
console.log("✓ mémoire récurrente : détection, compression et rappels morning brief validés");
console.log("✓ compression : contexte métier et preuves bornés avant appel IA");
