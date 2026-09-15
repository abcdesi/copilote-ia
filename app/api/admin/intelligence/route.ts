import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";

function normalized(value?: string | null) {
  return value?.trim() || "Non renseigné";
}

function isAdmin(email?: string | null) {
  if (!email) return false;
  const allowed = (process.env.PILOTZIA_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

type Bucket = {
  companies: number;
  opportunities: number;
  automations: number;
  totalEstimatedValueEur: number;
  totalEstimatedHoursPerMonth: number;
  acceptedOpportunities: number;
};

function ensureBucket(map: Map<string, Bucket>, key: string) {
  if (!map.has(key)) {
    map.set(key, {
      companies: 0,
      opportunities: 0,
      automations: 0,
      totalEstimatedValueEur: 0,
      totalEstimatedHoursPerMonth: 0,
      acceptedOpportunities: 0,
    });
  }
  return map.get(key)!;
}

function summarize(map: Map<string, Bucket>) {
  return Array.from(map.entries())
    .map(([segment, value]) => ({
      segment,
      ...value,
      avgOpportunitiesPerCompany: value.companies ? value.opportunities / value.companies : 0,
      avgEstimatedValueEurPerCompany: value.companies ? value.totalEstimatedValueEur / value.companies : 0,
      avgEstimatedHoursPerCompany: value.companies ? value.totalEstimatedHoursPerMonth / value.companies : 0,
      opportunityAcceptanceRate: value.opportunities ? value.acceptedOpportunities / value.opportunities : 0,
    }))
    .sort((a, b) => b.companies - a.companies);
}

export async function GET() {
  const session = await requireSession();
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  }

  const companies = await prisma.company.findMany({
    select: {
      id: true,
      industry: true,
      country: true,
      sizeRange: true,
      opportunities: {
        select: {
          status: true,
          estimatedValueEur: true,
          estimatedHoursPerMonth: true,
          category: true,
          templateId: true,
        },
      },
      automations: { select: { id: true, templateId: true, status: true } },
    },
  });

  const byIndustry = new Map<string, Bucket>();
  const byCountry = new Map<string, Bucket>();
  const bySize = new Map<string, Bucket>();
  const needCounts = new Map<string, { count: number; value: number; hours: number; accepted: number }>();

  for (const company of companies) {
    const buckets = [
      ensureBucket(byIndustry, normalized(company.industry)),
      ensureBucket(byCountry, normalized(company.country)),
      ensureBucket(bySize, normalized(company.sizeRange)),
    ];

    for (const bucket of buckets) bucket.companies += 1;

    for (const opportunity of company.opportunities) {
      const accepted = ["accepted", "installed", "purchased", "active"].includes(opportunity.status) ? 1 : 0;
      for (const bucket of buckets) {
        bucket.opportunities += 1;
        bucket.totalEstimatedValueEur += opportunity.estimatedValueEur;
        bucket.totalEstimatedHoursPerMonth += opportunity.estimatedHoursPerMonth;
        bucket.acceptedOpportunities += accepted;
      }

      const key = opportunity.templateId || opportunity.category || "unknown";
      const current = needCounts.get(key) || { count: 0, value: 0, hours: 0, accepted: 0 };
      current.count += 1;
      current.value += opportunity.estimatedValueEur;
      current.hours += opportunity.estimatedHoursPerMonth;
      current.accepted += accepted;
      needCounts.set(key, current);
    }

    for (const bucket of buckets) bucket.automations += company.automations.length;
  }

  const topNeeds = Array.from(needCounts.entries())
    .map(([need, stats]) => ({
      need,
      occurrences: stats.count,
      avgEstimatedValueEur: stats.count ? stats.value / stats.count : 0,
      avgEstimatedHoursPerMonth: stats.count ? stats.hours / stats.count : 0,
      acceptanceRate: stats.count ? stats.accepted / stats.count : 0,
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 25);

  return NextResponse.json({
    privacy: {
      mode: "aggregated",
      note: "Cette vue agrège les tendances. Elle ne doit pas exposer le contenu privé ou les données brutes d'une entreprise cliente.",
    },
    totals: {
      companies: companies.length,
      opportunities: companies.reduce((sum, company) => sum + company.opportunities.length, 0),
      automations: companies.reduce((sum, company) => sum + company.automations.length, 0),
    },
    segments: {
      industry: summarize(byIndustry),
      country: summarize(byCountry),
      size: summarize(bySize),
    },
    topNeeds,
  });
}
