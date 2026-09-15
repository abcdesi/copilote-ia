import { prisma } from "@/lib/db/client";
import { getUsageStatus } from "@/lib/billing/usage-policy";

export async function getTrialJourneyState(companyId: string) {
  const [usage, integrationCount, company] = await Promise.all([
    getUsageStatus(companyId),
    prisma.integrationConnection.count({ where: { companyId, status: "connected" } }).catch(() => 0),
    prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { objectives: true, painPoints: true, industry: true, sizeRange: true },
    }),
  ]);

  return {
    usage,
    hasConnection: integrationCount > 0,
    hasCompanyContext: Boolean(company.objectives || company.painPoints || company.industry || company.sizeRange),
  };
}
