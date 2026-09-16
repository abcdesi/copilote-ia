import { prisma } from "@/lib/db/client";
import { EVENTS } from "@/lib/analytics/events";
import {
  computeCompanyKnowledgeCoverage,
  type CompanyKnowledgeCoverage,
  type KnowledgeSectionKey,
} from "@/lib/companies/knowledge-model";

export type {
  CompanyKnowledgeCoverage,
  KnowledgeDimensionState,
  KnowledgeDimensionStatus,
  KnowledgeFreshness,
  KnowledgeGuidanceStep,
  KnowledgeMilestone,
  KnowledgeSection,
  KnowledgeSectionKey,
} from "@/lib/companies/knowledge-model";

const SECTION_KEYS: KnowledgeSectionKey[] = [
  "activity",
  "team",
  "objectives",
  "painPoints",
  "applications",
  "local",
  "finance",
  "accounting",
  "sales",
  "marketing",
  "hr",
  "operations",
];

function parseChangedSections(metadata: string | null) {
  if (!metadata) return [] as KnowledgeSectionKey[];
  try {
    const parsed = JSON.parse(metadata) as { sections?: unknown };
    if (typeof parsed.sections !== "string") return [];
    return parsed.sections
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is KnowledgeSectionKey => SECTION_KEYS.includes(value as KnowledgeSectionKey));
  } catch {
    return [] as KnowledgeSectionKey[];
  }
}

export async function getCompanyKnowledgeCoverage(companyId: string): Promise<CompanyKnowledgeCoverage> {
  const [company, connections, facts, contextEvents] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { tools: true } }),
    prisma.integrationConnection.findMany({
      where: { companyId, status: { in: ["connected", "active"] } },
      select: { provider: true, accountLabel: true, lastSyncedAt: true },
    }),
    prisma.businessFact.findMany({
      where: { companyId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      select: { predicate: true, sourceProvider: true, sourceRef: true, valueJson: true, observedAt: true },
      take: 500,
    }),
    prisma.event.findMany({
      where: { companyId, type: EVENTS.COMPANY_CONTEXT_UPDATED },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: { metadata: true, createdAt: true },
    }),
  ]);

  // Les faits `graph:*` et la mémoire compacte `pilotzia-memory` sont des dérivés de données
  // déjà connues par Pilotzia. Ils sont utiles au raisonnement et à l'anticipation, mais ne
  // constituent pas une preuve indépendante et ne doivent jamais gonfler le score de couverture.
  const independentFacts = facts.filter(
    (fact) =>
      !(fact.sourceProvider === "pilotzia" && fact.sourceRef?.startsWith("graph:")) &&
      fact.sourceProvider !== "pilotzia-memory"
  );

  const sectionUpdatedAt: Partial<Record<KnowledgeSectionKey, string | null>> = {};
  for (const event of contextEvents) {
    for (const section of parseChangedSections(event.metadata)) {
      if (!sectionUpdatedAt[section]) sectionUpdatedAt[section] = event.createdAt.toISOString();
    }
  }

  // Avant l'introduction du journal de fraîcheur, on ne connaît pas la date par rubrique.
  // On utilise donc updatedAt comme point de départ prudent pour les rubriques déjà remplies.
  for (const section of SECTION_KEYS) {
    if (!sectionUpdatedAt[section]) sectionUpdatedAt[section] = company.updatedAt.toISOString();
  }

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
    connections: connections.map((connection) => ({
      provider: connection.provider,
      accountLabel: connection.accountLabel,
      lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
    })),
    facts: independentFacts.map((fact) => ({
      predicate: fact.predicate,
      sourceProvider: fact.sourceProvider,
      sourceRef: fact.sourceRef,
      valueJson: fact.valueJson,
      observedAt: fact.observedAt.toISOString(),
    })),
    sectionUpdatedAt,
  });
}