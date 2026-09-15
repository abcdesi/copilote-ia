import { PLAN_DEFINITIONS } from "@/lib/billing/plans";

export const APP_NAME = "Pilotzia";
export const APP_TAGLINE = "Le système opérationnel IA qui comprend votre entreprise et agit dessus";
export const SITE_URL = (process.env.APP_URL || "https://www.pilotzia.com").replace(/\/$/, "");

export const PLAN_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(PLAN_DEFINITIONS).map(([key, plan]) => [key, plan.label])
);

export const PLAN_PRICES_EUR: Record<string, number> = Object.fromEntries(
  Object.entries(PLAN_DEFINITIONS).map(([key, plan]) => [key, plan.priceEur])
);
