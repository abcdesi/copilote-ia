import { prisma } from "@/lib/db/client";
import type { ChatContext } from "@/lib/ai/types";
import { IMPACT_RANK } from "@/lib/format";

export async function buildChatContext(companyId: string): Promise<ChatContext> {
  const [company, automations, opportunities] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { tools: true } }),
    prisma.automation.findMany({ where: { companyId } }),
    prisma.opportunity.findMany({
      where: { companyId, status: { in: ["detected", "viewed"] } },
      orderBy: { estimatedValueEur: "desc" },
    }),
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
