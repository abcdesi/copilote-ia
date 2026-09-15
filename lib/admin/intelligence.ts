import { prisma } from "@/lib/db/client";
import { minimumBenchmarkCohortSize } from "@/lib/admin/access";

function normalized(value?: string | null) {
  return value?.trim() || "Non renseigné";
}

type Bucket = {
  companies: number;
  paidCompanies: number;
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
      paidCompanies: 0,
      opportunities: 0,
      automations: 0,
      totalEstimatedValueEur: 0,
      totalEstimatedHoursPerMonth: 0,
      acceptedOpportunities: 0,
    });
  }
  return map.get(key)!;
}

function summarize(map: Map<string, Bucket>, minCohort: number) {
  return Array.from(map.entries())
    .filter(([, value]) => value.companies >= minCohort)
    .map(([segment, value]) => ({
      segment,
      ...value,
      paidRate: value.companies ? value.paidCompanies / value.companies : 0,
      avgOpportunitiesPerCompany: value.companies ? value.opportunities / value.companies : 0,
      avgEstimatedValueEurPerCompany: value.companies ? value.totalEstimatedValueEur / value.companies : 0,
      avgEstimatedHoursPerCompany: value.companies ? value.totalEstimatedHoursPerMonth / value.companies : 0,
      opportunityAcceptanceRate: value.opportunities ? value.acceptedOpportunities / value.opportunities : 0,
    }))
    .sort((a, b) => b.companies - a.companies);
}

export async function buildAdminIntelligenceSummary() {
  const minCohort = minimumBenchmarkCohortSize();
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      industry: true,
      country: true,
      sizeRange: true,
      subscriptions: {
        select: { plan: true, status: true },
        take: 1,
        orderBy: { createdAt: "desc" },
      },
      opportunities: {
        select: {
          status: true,
          estimatedValueEur: true,
          estimatedHoursPerMonth: true,
          category: true,
          templateId: true,
        },
      },
      automations: {
        select: {
          id: true,
          name: true,
          templateId: true,
          status: true,
          estimatedValueEur: true,
          estimatedHoursPerMonth: true,
          feedback: { select: { sentiment: true, timeSavedPerWeek: true } },
        },
      },
    },
  });

  const byIndustry = new Map<string, Bucket>();
  const byCountry = new Map<string, Bucket>();
  const bySize = new Map<string, Bucket>();
  const planCounts = new Map<string, number>();
  const needCounts = new Map<
    string,
    { companyIds: Set<string>; occurrences: number; value: number; hours: number; accepted: number }
  >();
  const solutionCounts = new Map<
    string,
    {
      companyIds: Set<string>;
      name: string;
      installs: number;
      active: number;
      estimatedValueEur: number;
      estimatedHours: number;
      positiveFeedback: number;
      feedbackCount: number;
      observedTimeSavedPerWeek: number;
    }
  >();

  let paidCompanies = 0;
  let activeAutomations = 0;

  for (const company of companies) {
    const subscription = company.subscriptions[0];
    const paid = Boolean(
      subscription && subscription.plan !== "free" && ["active", "trialing"].includes(subscription.status)
    );
    const plan = paid ? subscription!.plan : "free";
    planCounts.set(plan, (planCounts.get(plan) || 0) + 1);
    if (paid) paidCompanies += 1;

    const buckets = [
      ensureBucket(byIndustry, normalized(company.industry)),
      ensureBucket(byCountry, normalized(company.country)),
      ensureBucket(bySize, normalized(company.sizeRange)),
    ];

    for (const bucket of buckets) {
      bucket.companies += 1;
      if (paid) bucket.paidCompanies += 1;
    }

    for (const opportunity of company.opportunities) {
      const accepted = ["accepted", "installed", "purchased", "active"].includes(opportunity.status) ? 1 : 0;
      for (const bucket of buckets) {
        bucket.opportunities += 1;
        bucket.totalEstimatedValueEur += opportunity.estimatedValueEur;
        bucket.totalEstimatedHoursPerMonth += opportunity.estimatedHoursPerMonth;
        bucket.acceptedOpportunities += accepted;
      }

      const key = opportunity.templateId || opportunity.category || "unknown";
      const current = needCounts.get(key) || {
        companyIds: new Set<string>(),
        occurrences: 0,
        value: 0,
        hours: 0,
        accepted: 0,
      };
      current.companyIds.add(company.id);
      current.occurrences += 1;
      current.value += opportunity.estimatedValueEur;
      current.hours += opportunity.estimatedHoursPerMonth;
      current.accepted += accepted;
      needCounts.set(key, current);
    }

    for (const automation of company.automations) {
      for (const bucket of buckets) bucket.automations += 1;
      if (automation.status === "active") activeAutomations += 1;

      const key = automation.templateId || automation.name;
      const current = solutionCounts.get(key) || {
        companyIds: new Set<string>(),
        name: automation.name,
        installs: 0,
        active: 0,
        estimatedValueEur: 0,
        estimatedHours: 0,
        positiveFeedback: 0,
        feedbackCount: 0,
        observedTimeSavedPerWeek: 0,
      };
      current.companyIds.add(company.id);
      current.installs += 1;
      current.active += automation.status === "active" ? 1 : 0;
      current.estimatedValueEur += automation.estimatedValueEur;
      current.estimatedHours += automation.estimatedHoursPerMonth;
      for (const feedback of automation.feedback) {
        current.feedbackCount += 1;
        if (["positive", "up", "helpful", "good"].includes(feedback.sentiment.toLowerCase())) current.positiveFeedback += 1;
        current.observedTimeSavedPerWeek += feedback.timeSavedPerWeek || 0;
      }
      solutionCounts.set(key, current);
    }
  }

  const topNeeds = Array.from(needCounts.entries())
    .filter(([, stats]) => stats.companyIds.size >= minCohort)
    .map(([need, stats]) => ({
      need,
      companies: stats.companyIds.size,
      occurrences: stats.occurrences,
      avgEstimatedValueEur: stats.occurrences ? stats.value / stats.occurrences : 0,
      avgEstimatedHoursPerMonth: stats.occurrences ? stats.hours / stats.occurrences : 0,
      acceptanceRate: stats.occurrences ? stats.accepted / stats.occurrences : 0,
    }))
    .sort((a, b) => b.companies - a.companies || b.acceptanceRate - a.acceptanceRate)
    .slice(0, 25);

  const topSolutions = Array.from(solutionCounts.entries())
    .filter(([, stats]) => stats.companyIds.size >= minCohort)
    .map(([solution, stats]) => ({
      solution,
      name: stats.name,
      companies: stats.companyIds.size,
      installs: stats.installs,
      activeRate: stats.installs ? stats.active / stats.installs : 0,
      avgEstimatedValueEur: stats.installs ? stats.estimatedValueEur / stats.installs : 0,
      avgEstimatedHoursPerMonth: stats.installs ? stats.estimatedHours / stats.installs : 0,
      feedbackCount: stats.feedbackCount,
      positiveFeedbackRate: stats.feedbackCount ? stats.positiveFeedback / stats.feedbackCount : null,
      avgObservedTimeSavedPerWeek: stats.feedbackCount
        ? stats.observedTimeSavedPerWeek / stats.feedbackCount
        : null,
    }))
    .sort((a, b) => b.companies - a.companies || b.activeRate - a.activeRate)
    .slice(0, 25);

  return {
    privacy: {
      mode: "aggregated" as const,
      minimumCohort: minCohort,
      note: "Les segments, besoins et solutions sous le seuil de cohorte sont masqués. Aucun contenu brut ou identifiant d'une entreprise cliente n'est exposé dans cette vue.",
    },
    totals: {
      companies: companies.length,
      paidCompanies,
      paidRate: companies.length ? paidCompanies / companies.length : 0,
      opportunities: companies.reduce((sum, company) => sum + company.opportunities.length, 0),
      automations: companies.reduce((sum, company) => sum + company.automations.length, 0),
      activeAutomations,
    },
    plans: Array.from(planCounts.entries())
      .map(([plan, companiesCount]) => ({ plan, companies: companiesCount }))
      .sort((a, b) => b.companies - a.companies),
    segments: {
      industry: summarize(byIndustry, minCohort),
      country: summarize(byCountry, minCohort),
      size: summarize(bySize, minCohort),
    },
    topNeeds,
    topSolutions,
  };
}

export type AdminIntelligenceSummary = Awaited<ReturnType<typeof buildAdminIntelligenceSummary>>;
