import { prisma } from "@/lib/db/client";

export const MARKETING_KPI_EVENT = "MARKETING_KPI_SNAPSHOT";

export interface MarketingKpiSnapshot {
  source: "manual";
  observedAt: string;
  spendEur: number;
  leads: number;
  conversions: number;
  customers: number;
  revenueEur: number;
}

export interface DerivedMarketingKpis {
  cplEur: number | null;
  cpaEur: number | null;
  cacEur: number | null;
  roas: number | null;
  leadToCustomerRate: number | null;
}

function finiteNonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function deriveMarketingKpis(snapshot: MarketingKpiSnapshot): DerivedMarketingKpis {
  return {
    cplEur: snapshot.leads > 0 ? snapshot.spendEur / snapshot.leads : null,
    cpaEur: snapshot.conversions > 0 ? snapshot.spendEur / snapshot.conversions : null,
    cacEur: snapshot.customers > 0 ? snapshot.spendEur / snapshot.customers : null,
    roas: snapshot.spendEur > 0 ? snapshot.revenueEur / snapshot.spendEur : null,
    leadToCustomerRate: snapshot.leads > 0 ? (snapshot.customers / snapshot.leads) * 100 : null,
  };
}

export function parseMarketingKpiSnapshot(metadata: string | null): MarketingKpiSnapshot | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as Partial<MarketingKpiSnapshot>;
    if (
      parsed.source !== "manual" ||
      typeof parsed.observedAt !== "string" ||
      !finiteNonNegative(parsed.spendEur) ||
      !finiteNonNegative(parsed.leads) ||
      !finiteNonNegative(parsed.conversions) ||
      !finiteNonNegative(parsed.customers) ||
      !finiteNonNegative(parsed.revenueEur)
    ) {
      return null;
    }

    return {
      source: "manual",
      observedAt: parsed.observedAt,
      spendEur: parsed.spendEur,
      leads: parsed.leads,
      conversions: parsed.conversions,
      customers: parsed.customers,
      revenueEur: parsed.revenueEur,
    };
  } catch {
    return null;
  }
}

export async function getLatestMarketingKpiSnapshot(companyId: string): Promise<MarketingKpiSnapshot | null> {
  const event = await prisma.event.findFirst({
    where: { companyId, type: MARKETING_KPI_EVENT },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });
  return parseMarketingKpiSnapshot(event?.metadata ?? null);
}
