import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { runMockDiagnostic } from "@/lib/ai/mock-engine";
import { rebuildBusinessGraph } from "@/lib/business-graph";
import { syncGoogleOperationalSnapshot } from "@/lib/integrations/observe";
import { GOOGLE_SCOPES, parseStoredGoogleScopes } from "@/lib/integrations/google";
import { getGoogleMarketingState, syncGoogleMarketingSnapshot } from "@/lib/integrations/google-marketing";

const WEEKLY_REFRESH_MIN_INTERVAL_MS = (6 * 24 + 23) * 60 * 60 * 1000;
const WEEKLY_REFRESH_IN_PROGRESS_TTL_MS = 2 * 60 * 60 * 1000;
const WEEKLY_REFRESH_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function json(value: unknown) {
  return JSON.stringify(value);
}

function opportunityChanged(
  current: {
    title: string;
    description: string;
    category: string;
    impactLevel: string;
    complexity: string;
    estimatedHoursPerMonth: number;
    estimatedValueEur: number;
    priceEur: number;
  },
  next: {
    title: string;
    description: string;
    category: string;
    impactLevel: string;
    complexity: string;
    estimatedHoursPerMonth: number;
    estimatedValueEur: number;
    priceEur: number;
  }
) {
  return (
    current.title !== next.title ||
    current.description !== next.description ||
    current.category !== next.category ||
    current.impactLevel !== next.impactLevel ||
    current.complexity !== next.complexity ||
    current.estimatedHoursPerMonth !== next.estimatedHoursPerMonth ||
    current.estimatedValueEur !== next.estimatedValueEur ||
    current.priceEur !== next.priceEur
  );
}

async function refreshDeterministicOpportunities(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { tools: { select: { name: true } } },
  });
  if (!company) return { created: 0, updated: 0, stale: 0, automationScore: 0, activeTemplateIds: [] as string[] };

  const input = [
    company.painPoints,
    company.objectives,
    company.industry,
    company.businessModel,
    company.salesContext,
    company.marketingContext,
    company.operationsContext,
    company.financeContext,
  ]
    .filter(Boolean)
    .join(". ")
    .trim() || company.name;

  const diagnostic = runMockDiagnostic(input, company.tools.map((tool) => tool.name));
  const [existing, previousRefresh] = await Promise.all([
    prisma.opportunity.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.event.findFirst({
      where: { companyId, type: "WEEKLY_REFRESH_COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    }),
  ]);

  const activeTemplateIds = diagnostic.opportunities.map((opportunity) => opportunity.templateId);
  let previousActiveTemplateIds: string[] = [];
  if (previousRefresh?.metadata) {
    try {
      const parsed = JSON.parse(previousRefresh.metadata) as {
        deterministicOpportunityRefresh?: { activeTemplateIds?: unknown };
      };
      const previous = parsed.deterministicOpportunityRefresh?.activeTemplateIds;
      if (Array.isArray(previous)) {
        previousActiveTemplateIds = previous.filter((item): item is string => typeof item === "string");
      }
    } catch {
      previousActiveTemplateIds = [];
    }
  }

  let created = 0;
  let updated = 0;
  let stale = 0;

  await prisma.$transaction(async (tx) => {
    for (const opportunity of diagnostic.opportunities) {
      const current = existing.find((item) => item.templateId === opportunity.templateId);
      if (!current) {
        await tx.opportunity.create({
          data: {
            companyId,
            templateId: opportunity.templateId,
            title: opportunity.title,
            description: opportunity.description,
            category: opportunity.category,
            impactLevel: opportunity.impactLevel,
            complexity: opportunity.complexity,
            estimatedHoursPerMonth: opportunity.estimatedHoursPerMonth,
            estimatedValueEur: opportunity.estimatedValueEur,
            priceEur: opportunity.priceEur,
            status: "detected",
          },
        });
        created += 1;
        continue;
      }

      // Une décision humaine passée reste la source de vérité : un refresh ne réactive
      // jamais silencieusement une opportunité installée ou rejetée. Une opportunité
      // uniquement devenue obsolète peut, elle, redevenir active si le contexte la soutient.
      if (!["detected", "viewed", "stale"].includes(current.status)) continue;

      const next = {
        title: opportunity.title,
        description: opportunity.description,
        category: opportunity.category,
        impactLevel: opportunity.impactLevel,
        complexity: opportunity.complexity,
        estimatedHoursPerMonth: opportunity.estimatedHoursPerMonth,
        estimatedValueEur: opportunity.estimatedValueEur,
        priceEur: opportunity.priceEur,
      };
      const shouldReactivate = current.status === "stale";
      if (!opportunityChanged(current, next) && !shouldReactivate) continue;

      await tx.opportunity.update({
        where: { id: current.id },
        data: { ...next, ...(shouldReactivate ? { status: "detected" } : {}) },
      });
      updated += 1;
    }

    const currentActiveSet = new Set(activeTemplateIds);
    const previouslyManagedSet = new Set(previousActiveTemplateIds);
    const toStale = existing.filter(
      (item) =>
        ["detected", "viewed"].includes(item.status) &&
        previouslyManagedSet.has(item.templateId) &&
        !currentActiveSet.has(item.templateId)
    );
    for (const opportunity of toStale) {
      await tx.opportunity.update({ where: { id: opportunity.id }, data: { status: "stale" } });
      stale += 1;
    }

    if (company.automationScore !== diagnostic.automationScore) {
      await tx.company.update({
        where: { id: companyId },
        data: { automationScore: diagnostic.automationScore },
      });
    }
  });

  return { created, updated, stale, automationScore: diagnostic.automationScore, activeTemplateIds };
}

export async function runWeeklyBusinessRefresh(companyId: string) {
  const refreshId = randomUUID();
  const now = new Date();
  const lock = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${companyId} FOR UPDATE`;
      const [latest, inProgress] = await Promise.all([
        tx.event.findFirst({
          where: {
            companyId,
            type: "WEEKLY_REFRESH_COMPLETED",
            createdAt: { gte: new Date(now.getTime() - WEEKLY_REFRESH_MIN_INTERVAL_MS) },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        }),
        tx.event.findFirst({
          where: {
            companyId,
            type: "WEEKLY_REFRESH_STARTED",
            createdAt: { gte: new Date(now.getTime() - WEEKLY_REFRESH_IN_PROGRESS_TTL_MS) },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        }),
      ]);
      if (latest) {
        return { allowed: false as const, reason: "already_fresh" as const, lastCompletedAt: latest.createdAt };
      }
      if (inProgress) {
        return { allowed: false as const, reason: "refresh_in_progress" as const, lastCompletedAt: null };
      }

      await tx.event.create({
        data: {
          companyId,
          type: "WEEKLY_REFRESH_STARTED",
          metadata: json({
            refreshId,
            startedAt: now.toISOString(),
            aiBudget: { creditsMax: 0, variableCostEurMax: 0 },
          }),
        },
      });
      return { allowed: true as const };
    },
    { timeout: 10_000 }
  );

  if (!lock.allowed) {
    return {
      ok: true as const,
      skipped: true as const,
      reason: lock.reason,
      lastCompletedAt: lock.lastCompletedAt,
    };
  }

  const startedAt = Date.now();
  const summary: Record<string, unknown> = {
    refreshId,
    providerSyncs: [] as string[],
    providerErrors: [] as string[],
    aiTriggered: false,
    aiCreditsUsed: 0,
    aiVariableCostEur: 0,
  };

  try {
    const connections = await prisma.integrationConnection.findMany({
      where: { companyId, status: "connected" },
      select: { provider: true, lastSyncedAt: true, scopes: true, settingsJson: true },
    });

    const google = connections.find((connection) => connection.provider === "google");
    if (google) {
      const granted = parseStoredGoogleScopes(google.scopes);
      const workspaceScopes = GOOGLE_SCOPES.filter((scope) => scope.includes("gmail.") || scope.includes("calendar."));
      const workspaceAuthorized = workspaceScopes.every((scope) => granted.includes(scope));

      if (workspaceAuthorized) {
        try {
          await syncGoogleOperationalSnapshot(companyId, null, "scheduled");
          (summary.providerSyncs as string[]).push("google_workspace");
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 240) : "Erreur Google Workspace";
          (summary.providerErrors as string[]).push("google_workspace:" + message);
        }
      }

      const marketing = await getGoogleMarketingState(companyId);
      const marketingConfigured =
        (marketing.analyticsAuthorized && Boolean(marketing.settings.ga4PropertyId)) ||
        (marketing.adsAuthorized &&
          marketing.adsServerConfigured &&
          Boolean(marketing.settings.googleAdsCustomerId));
      if (marketingConfigured) {
        try {
          await syncGoogleMarketingSnapshot(companyId, null, "scheduled");
          (summary.providerSyncs as string[]).push("google_marketing");
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 240) : "Erreur Google Marketing";
          (summary.providerErrors as string[]).push("google_marketing:" + message);
        }
      }
    }

    const opportunities = await refreshDeterministicOpportunities(companyId);
    const graph = await rebuildBusinessGraph(companyId);

    const lookback = new Date(now.getTime() - WEEKLY_REFRESH_LOOKBACK_MS);
    const [recentContextChanges, recentRuns, recentFinancialFacts] = await Promise.all([
      prisma.companyContextRevision.count({ where: { companyId, effectiveAt: { gte: lookback } } }),
      prisma.automationRun.count({
        where: { automation: { companyId }, startedAt: { gte: lookback } },
      }),
      prisma.businessFact.count({
        where: {
          companyId,
          sourceProvider: "pilotzia_finance",
          observedAt: { gte: lookback },
        },
      }),
    ]);

    Object.assign(summary, {
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      deterministicOpportunityRefresh: opportunities,
      businessGraph: {
        readinessScore: graph.readinessScore,
        entityCount: graph.entityCount,
        factCount: graph.factCount,
        freshSourceCount: graph.freshSourceCount,
        staleSourceCount: graph.staleSourceCount,
      },
      recentSignals: {
        contextChanges: recentContextChanges,
        automationRuns: recentRuns,
        financialFacts: recentFinancialFacts,
      },
      materialChange:
        opportunities.created > 0 ||
        opportunities.updated > 0 ||
        recentContextChanges > 0 ||
        recentRuns > 0 ||
        recentFinancialFacts > 0 ||
        (summary.providerSyncs as string[]).length > 0,
    });

    await prisma.event.create({
      data: {
        companyId,
        type: "WEEKLY_REFRESH_COMPLETED",
        metadata: json(summary),
      },
    });

    return { ok: true as const, skipped: false as const, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Erreur inconnue";
    await prisma.event.create({
      data: {
        companyId,
        type: "WEEKLY_REFRESH_FAILED",
        metadata: json({
          refreshId,
          failedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          error: message,
          aiTriggered: false,
          aiCreditsUsed: 0,
          aiVariableCostEur: 0,
        }),
      },
    });
    return { ok: false as const, skipped: false as const, error: message };
  }
}
