export type PlanKey = "free" | "starter" | "pro" | "business";

export interface PlanDefinition {
  key: PlanKey;
  label: string;
  priceEur: number;
  positioning: string;
  monthlyCredits: number;
  variableCostCapEur: number;
  features: string[];
}

function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const PLAN_DEFINITIONS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    label: "Découverte",
    priceEur: 0,
    positioning: "Voir le potentiel de Pilotzia sur votre entreprise avant de payer.",
    monthlyCredits: envNumber("PILOTZIA_TRIAL_CREDITS", 100),
    variableCostCapEur: envNumber("PILOTZIA_TRIAL_COST_CAP_EUR", 3),
    features: [
      "Diagnostic public gratuit",
      "14 jours d'essai après le premier usage IA réel",
      "Contexte et historique conservés après l'essai",
    ],
  },
  starter: {
    key: "starter",
    label: "Core",
    priceEur: 49,
    positioning: "Comprendre, prioriser et piloter votre entreprise avec un contexte vivant.",
    monthlyCredits: envNumber("PILOTZIA_CORE_MONTHLY_CREDITS", 600),
    variableCostCapEur: envNumber("PILOTZIA_CORE_COST_CAP_EUR", 8),
    features: [
      "Business Graph vivant",
      "Copilote de direction et Morning Brief",
      "Recommandations continues avec niveau de preuve",
      "Historique du contexte et des décisions",
    ],
  },
  pro: {
    key: "pro",
    label: "Action",
    priceEur: 99,
    positioning: "Passer du conseil à l'exécution contrôlée et mesurer les résultats.",
    monthlyCredits: envNumber("PILOTZIA_ACTION_MONTHLY_CREDITS", 2000),
    variableCostCapEur: envNumber("PILOTZIA_ACTION_COST_CAP_EUR", 18),
    features: [
      "Tout Core",
      "Actions et automatisations dans les outils connectés",
      "Confirmations pour les actions sensibles",
      "Monitoring, incidents et suivi ROI",
    ],
  },
  business: {
    key: "business",
    label: "Scale",
    priceEur: 249,
    positioning: "Audit de direction, intelligence financière et pilotage avancé pour une entreprise plus complexe.",
    monthlyCredits: envNumber("PILOTZIA_SCALE_MONTHLY_CREDITS", 7000),
    variableCostCapEur: envNumber("PILOTZIA_SCALE_COST_CAP_EUR", 45),
    features: [
      "Tout Action",
      "Audit avancé et intelligence financière",
      "Analyses croisées, benchmarks agrégés et recommandations de direction",
      "Volumes, gouvernance et usages équipe supérieurs",
    ],
  },
};

export const PAID_PLAN_KEYS = ["starter", "pro", "business"] as const;
export type PaidPlanKey = (typeof PAID_PLAN_KEYS)[number];

export function getPlanDefinition(plan?: string | null): PlanDefinition {
  if (plan === "starter" || plan === "pro" || plan === "business") return PLAN_DEFINITIONS[plan];
  return PLAN_DEFINITIONS.free;
}
