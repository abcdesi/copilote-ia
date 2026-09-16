import { prisma } from "@/lib/db/client";
import {
  computeCompanyKnowledgeCoverage,
  type CompanyKnowledgeCoverage,
} from "@/lib/companies/knowledge-model";

export type {
  CompanyKnowledgeCoverage,
  KnowledgeGuidanceStep,
  KnowledgeMilestone,
  KnowledgeSection,
  KnowledgeSectionKey,
} from "@/lib/companies/knowledge-model";

export async function getCompanyKnowledgeCoverage(companyId: string): Promise<CompanyKnowledgeCoverage> {
  const [company, connections, facts] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { tools: true } }),
    prisma.integrationConnection.findMany({
      where: { companyId, status: { in: ["connected", "active"] } },
      select: { provider: true, accountLabel: true },
    }),
    prisma.businessFact.findMany({
      where: { companyId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { predicate: true, sourceProvider: true, sourceRef: true, valueJson: true },
      take: 500,
    }),
  ]);

  return computeCompanyKnowledgeCoverage({
    company: {
      industry: company.industry,
      country: company.country,
      sizeRange: company.sizeRange,
      employeeCount: company.employeeCount,
      objectives: company.objectives,
      painPoints: company.painPoints,
      businessModel: company.businessModel,
      customerProfile: company.customerProfile,
      localContext: company.localContext,
      financeContext: company.financeContext,
      marketingContext: company.marketingContext,
      accountingContext: company.accountingContext,
      salesContext: company.salesContext,
      hrContext: company.hrContext,
      operationsContext: company.operationsContext,
    },
    tools: company.tools.map((tool) => tool.name),
    connections,
    facts,
  });
}
