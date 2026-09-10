import { prisma } from "@/lib/db/client";
import type { DiagnosticResult } from "@/lib/ai/types";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

export async function materializeOpportunities(
  companyId: string,
  result: DiagnosticResult,
  sourceDiagnosticId?: string
) {
  const created = await prisma.$transaction(
    result.opportunities.map((opp) =>
      prisma.opportunity.create({
        data: {
          companyId,
          sourceDiagnosticId,
          templateId: opp.templateId,
          title: opp.title,
          description: opp.description,
          category: opp.category,
          impactLevel: opp.impactLevel,
          complexity: opp.complexity,
          estimatedHoursPerMonth: opp.estimatedHoursPerMonth,
          estimatedValueEur: opp.estimatedValueEur,
          priceEur: opp.priceEur,
          status: "detected",
        },
      })
    )
  );

  await track(EVENTS.AUTOMATION_OPPORTUNITY_DETECTED, {
    companyId,
    metadata: { count: created.length },
  });

  return created;
}
