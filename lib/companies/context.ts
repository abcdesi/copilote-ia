import { prisma } from "@/lib/db/client";
import type { ChatContext } from "@/lib/ai/types";
import { IMPACT_RANK } from "@/lib/format";
import { getLatestGoogleOperationalSnapshot } from "@/lib/integrations/observe";
import { getBusinessGraphSummary, rebuildBusinessGraph } from "@/lib/business-graph";

export async function buildChatContext(companyId: string): Promise<ChatContext> {
  const graphExists = (await prisma.businessEntity.count({ where: { companyId } })) > 0;
  if (!graphExists) await rebuildBusinessGraph(companyId);

  const [company, automations, opportunities, connections, observations, businessGraph] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { tools: true } }),
    prisma.automation.findMany({ where: { companyId } }),
    prisma.opportunity.findMany({
      where: { companyId, status: { in: ["detected", "viewed"] } },
      orderBy: { estimatedValueEur: "desc" },
    }),
    prisma.integrationConnection.findMany({
      where: { companyId },
      select: { provider: true, status: true, accountLabel: true, lastSyncedAt: true },
    }),
    getLatestGoogleOperationalSnapshot(companyId),
    getBusinessGraphSummary(companyId),
  ]);

  opportunities.sort(
    (a, b) => IMPACT_RANK[b.impactLevel] - IMPACT_RANK[a.impactLevel] || b.estimatedValueEur - a.estimatedValueEur
  );

  const active = automations.filter((a) => a.status === "active");

  return {
    companyId: company.id,
    companyName: company.name,
    industry: company.industry,
    country: company.country,
    sizeRange: company.sizeRange,
    objectives: company.objectives,
    painPoints: company.painPoints,
    tools: company.tools.map((t) => t.name),
    connections: connections.map((connection) => ({
      provider: connection.provider,
      status: connection.status,
      accountLabel: connection.accountLabel,
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    })),
    observations,
    businessGraph: {
      readinessScore: businessGraph.readinessScore,
      entityCount: businessGraph.entityCount,
      factCount: businessGraph.factCount,
      connectedSourceCount: businessGraph.connectedSourceCount,
      freshSourceCount: businessGraph.freshSourceCount,
      entityTypes: businessGraph.entityTypes,
    },
    automations: automations.map((a) => ({
      name: a.name,
      status: a.status,
      health: a.health,
      estimatedHoursPerMonth: a.estimatedHoursPerMonth,
    })),
    automationScore: company.automationScore,
    totalHoursSavedThisMonth: active.reduce((s, a) => s + a.estimatedHoursPerMonth, 0),
    totalValueEurThisMonth: active.reduce((s, a) => s + a.estimatedValueEur, 0),
    topOpportunity: opportunities[0]
      ? { title: opportunities[0].title, estimatedHoursPerMonth: opportunities[0].estimatedHoursPerMonth }
      : null,
  };
}
