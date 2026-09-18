export type PlanKey = "free" | "starter" | "pro" | "business";
export type BillingCycle = "monthly" | "annual";

export interface PlanDefinition {
  key: PlanKey;
  label: string;
  priceEur: number;
  annualPriceEur: number;
  positioning: string;
  monthlyCredits: number;
  variableCostCapEur: number;
  includedSeats: number;
  features: string[];
}

// Les variables d'environnement peuvent réduire temporairement une enveloppe, jamais
// dépasser le plafond économique validé dans le code. Les capacités supérieures passent
// par un pack payé, pas par une variable qui pourrait casser la marge par accident.
function envAtMost(name: string, hardMaximum: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, hardMaximum) : hardMaximum;
}

export const PLAN_DEFINITIONS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    label: "Découverte",
    priceEur: 0,
    annualPriceEur: 0,
    positioning: "Voir le potentiel de Pilotzia sur votre entreprise avant de payer.",
    monthlyCredits: envAtMost("PILOTZIA_TRIAL_CREDITS", 100),
    variableCostCapEur: envAtMost("PILOTZIA_TRIAL_COST_CAP_EUR", 3),
    includedSeats: 1,
    features: [
      "Diagnostic public gratuit",
      "14 jours d'essai après le premier usage IA réel",
      "Contexte et historique conservés après l'essai",
      "1 utilisateur",
    ],
  },
  starter: {
    key: "starter",
    label: "Core",
    priceEur: 79,
    annualPriceEur: 869,
    positioning: "Comprendre, prioriser et piloter votre entreprise avec un contexte vivant.",
    monthlyCredits: envAtMost("PILOTZIA_CORE_MONTHLY_CREDITS", 700),
    variableCostCapEur: envAtMost("PILOTZIA_CORE_COST_CAP_EUR", 7),
    includedSeats: 1,
    features: [
      "Business Graph vivant",
      "Rafraîchissement hebdomadaire automatique du contexte",
      "Copilote de direction et Morning Brief",
      "Recommandations continues avec niveau de preuve",
      "Historique du contexte et des décisions",
      "1 utilisateur",
    ],
  },
  pro: {
    key: "pro",
    label: "Action",
    priceEur: 179,
    annualPriceEur: 1969,
    positioning: "Passer du conseil à l'exécution contrôlée et mesurer les résultats.",
    monthlyCredits: envAtMost("PILOTZIA_ACTION_MONTHLY_CREDITS", 2000),
    variableCostCapEur: envAtMost("PILOTZIA_ACTION_COST_CAP_EUR", 20),
    includedSeats: 3,
    features: [
      "Tout Core",
      "Actions et automatisations dans les outils connectés",
      "Confirmations pour les actions sensibles",
      "Monitoring, incidents et suivi des résultats",
      "3 utilisateurs avec rôles et traçabilité",
    ],
  },
  business: {
    key: "business",
    label: "Scale",
    priceEur: 399,
    annualPriceEur: 4389,
    positioning: "Audit de direction, intelligence financière et pilotage avancé pour une entreprise plus complexe.",
    monthlyCredits: envAtMost("PILOTZIA_SCALE_MONTHLY_CREDITS", 5000),
    variableCostCapEur: envAtMost("PILOTZIA_SCALE_COST_CAP_EUR", 50),
    includedSeats: 10,
    features: [
      "Tout Action",
      "Audit avancé et intelligence financière",
      "Analyses croisées et recommandations de direction fondées sur vos données",
      "Volumes, gouvernance et usages équipe supérieurs",
      "10 utilisateurs avec rôles et journal d'audit",
    ],
  },
};

export const PAID_PLAN_KEYS = ["starter", "pro", "business"] as const;
export type PaidPlanKey = (typeof PAID_PLAN_KEYS)[number];

export function getPlanDefinition(plan?: string | null): PlanDefinition {
  if (plan === "starter" || plan === "pro" || plan === "business") return PLAN_DEFINITIONS[plan];
  return PLAN_DEFINITIONS.free;
}

export function nextPaidPlan(plan?: string | null): PaidPlanKey | null {
  if (plan === "starter") return "pro";
  if (plan === "pro") return "business";
  return null;
}
