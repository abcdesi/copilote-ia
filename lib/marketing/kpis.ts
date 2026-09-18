import { prisma } from "@/lib/db/client";

export const MARKETING_KPI_EVENT = "MARKETING_KPI_SNAPSHOT";

export type MarketingKpiSource = "manual" | "google_marketing";

export interface MarketingKpiSnapshot {
  source: MarketingKpiSource;
  observedAt: string;
  periodDays: number;
  spendEur: number | null;
  leads: number | null;
  conversions: number | null;
  customers: number | null;
  revenueEur: number | null;
  attributedRevenueEur: number | null;
  sessions: number | null;
  users: number | null;
  clicks: number | null;
  impressions: number | null;
  currencyCode: string | null;
  providers: string[];
}

export interface DerivedMarketingKpis {
  cplEur: number | null;
  cpaEur: number | null;
  cacEur: number | null;
  roas: number | null;
  leadToCustomerRate: number | null;
  clickThroughRate: number | null;
  costPerClickEur: number | null;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function nullableMetric(value: unknown) {
  return finiteNonNegative(value) ? value : null;
}

export function deriveMarketingKpis(snapshot: MarketingKpiSnapshot): DerivedMarketingKpis {
  return {
    cplEur:
      snapshot.spendEur != null && snapshot.leads != null && snapshot.leads > 0
        ? snapshot.spendEur / snapshot.leads
        : null,
    cpaEur:
      snapshot.spendEur != null && snapshot.conversions != null && snapshot.conversions > 0
        ? snapshot.spendEur / snapshot.conversions
        : null,
    cacEur:
      snapshot.spendEur != null && snapshot.customers != null && snapshot.customers > 0
        ? snapshot.spendEur / snapshot.customers
        : null,
    roas:
      snapshot.spendEur != null &&
      snapshot.spendEur > 0 &&
      snapshot.attributedRevenueEur != null
        ? snapshot.attributedRevenueEur / snapshot.spendEur
        : null,
    leadToCustomerRate:
      snapshot.leads != null && snapshot.leads > 0 && snapshot.customers != null
        ? (snapshot.customers / snapshot.leads) * 100
        : null,
    clickThroughRate:
      snapshot.clicks != null && snapshot.impressions != null && snapshot.impressions > 0
        ? (snapshot.clicks / snapshot.impressions) * 100
        : null,
    costPerClickEur:
      snapshot.spendEur != null && snapshot.clicks != null && snapshot.clicks > 0
        ? snapshot.spendEur / snapshot.clicks
        : null,
  };
}

export function parseMarketingKpiSnapshot(metadata: string | null): MarketingKpiSnapshot | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    const source = parsed.source;
    if ((source !== "manual" && source !== "google_marketing") || typeof parsed.observedAt !== "string") {
      return null;
    }

    // Compatibilité avec les snapshots manuels créés avant l'arrivée des connecteurs Google.
    const revenueEur = nullableMetric(parsed.revenueEur);
    const attributedRevenueEur =
      nullableMetric(parsed.attributedRevenueEur) ?? (source === "manual" ? revenueEur : null);

    return {
      source,
      observedAt: parsed.observedAt,
      periodDays: finiteNonNegative(parsed.periodDays) ? parsed.periodDays : 30,
      spendEur: nullableMetric(parsed.spendEur),
      leads: nullableMetric(parsed.leads),
      conversions: nullableMetric(parsed.conversions),
      customers: nullableMetric(parsed.customers),
      revenueEur,
      attributedRevenueEur,
      sessions: nullableMetric(parsed.sessions),
      users: nullableMetric(parsed.users),
      clicks: nullableMetric(parsed.clicks),
      impressions: nullableMetric(parsed.impressions),
      currencyCode: typeof parsed.currencyCode === "string" ? parsed.currencyCode : source === "manual" ? "EUR" : null,
      providers: Array.isArray(parsed.providers)
        ? parsed.providers.filter((item): item is string => typeof item === "string")
        : source === "manual"
          ? ["manual"]
          : [],
    };
  } catch {
    return null;
  }
}

export async function getLatestMarketingKpiSnapshot(companyId: string): Promise<MarketingKpiSnapshot | null> {
  const events = await prisma.event.findMany({
    where: { companyId, type: MARKETING_KPI_EVENT },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
    take: 10,
  });
  for (const event of events) {
    const parsed = parseMarketingKpiSnapshot(event.metadata);
    if (parsed) return parsed;
  }
  return null;
}
