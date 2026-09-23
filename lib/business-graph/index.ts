import { prisma } from "@/lib/db/client";

export type BusinessGraphEntityType =
  | "company"
  | "tool"
  | "connection"
  | "automation"
  | "opportunity"
  | "process"
  | "person"
  | "customer"
  | "document";

interface EntityInput {
  type: BusinessGraphEntityType | string;
  canonicalKey: string;
  name: string;
  status?: string;
  attributes?: Record<string, unknown>;
  confidence?: number;
  sourceCount?: number;
  seenAt?: Date;
}

interface FactInput {
  subjectEntityId: string;
  predicate: string;
  objectEntityId?: string | null;
  value?: unknown;
  sourceProvider: string;
  sourceRef: string;
  confidence?: number;
  observedAt?: Date;
  expiresAt?: Date | null;
  provenance?: Record<string, unknown>;
}

export interface BusinessGraphSummary {
  readinessScore: number;
  entityCount: number;
  factCount: number;
  sourceCount: number;
  connectedSourceCount: number;
  freshSourceCount: number;
  staleSourceCount: number;
  entityTypes: Array<{ type: string; count: number }>;
  sources: Array<{
    provider: string;
    status: string;
    accountLabel: string | null;
    lastSyncedAt: string | null;
    fresh: boolean;
  }>;
  lastBuiltAt: string | null;
}

function json(value: unknown) {
  return JSON.stringify(value);
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function slug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
}

async function upsertEntity(companyId: string, input: EntityInput) {
  const seenAt = input.seenAt ?? new Date();
  return prisma.businessEntity.upsert({
    where: {
      companyId_type_canonicalKey: {
        companyId,
        type: input.type,
        canonicalKey: input.canonicalKey,
      },
    },
    create: {
      companyId,
      type: input.type,
      canonicalKey: input.canonicalKey,
      name: input.name,
      status: input.status ?? "active",
      attributesJson: input.attributes ? json(input.attributes) : null,
      confidence: input.confidence ?? 1,
      sourceCount: input.sourceCount ?? 1,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
    },
    update: {
      name: input.name,
      status: input.status ?? "active",
      attributesJson: input.attributes ? json(input.attributes) : null,
      confidence: input.confidence ?? 1,
      sourceCount: input.sourceCount ?? 1,
      lastSeenAt: seenAt,
    },
  });
}

async function addFact(companyId: string, input: FactInput) {
  return prisma.businessFact.create({
    data: {
      companyId,
      subjectEntityId: input.subjectEntityId,
      predicate: input.predicate,
      objectEntityId: input.objectEntityId ?? null,
      valueJson: input.value === undefined ? null : json(input.value),
      sourceProvider: input.sourceProvider,
      sourceRef: input.sourceRef,
      confidence: input.confidence ?? 1,
      observedAt: input.observedAt ?? new Date(),
      expiresAt: input.expiresAt ?? null,
      provenanceJson: input.provenance ? json(input.provenance) : null,
    },
  });
}

/**
 * Rebuild idempotent du graphe géré par Pilotzia.
 * Les faits dont sourceRef commence par `graph:` sont recalculables et remplacés.
 * Les futurs faits importés/validés manuellement restent intacts.
 */
export async function rebuildBusinessGraph(companyId: string) {
  const [company, automations, opportunities, connections, integrationSnapshots] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { tools: true } }),
    prisma.automation.findMany({ where: { companyId } }),
    prisma.opportunity.findMany({ where: { companyId } }),
    prisma.integrationConnection.findMany({ where: { companyId } }),
    prisma.event.findMany({
      where: { companyId, type: "INTEGRATION_SNAPSHOT" },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const snapshotsByProvider = new Map<string, (typeof integrationSnapshots)[number]>();
  for (const event of integrationSnapshots) {
    if (!event.metadata) continue;
    try {
      const parsed = JSON.parse(event.metadata) as { provider?: string };
      if (parsed.provider && !snapshotsByProvider.has(parsed.provider)) snapshotsByProvider.set(parsed.provider, event);
    } catch {
      // Snapshot invalide : il reste exclu du graphe.
    }
  }
  const latestGoogleSnapshot = snapshotsByProvider.get("google");
  const latestHubSpotSnapshot = snapshotsByProvider.get("hubspot");

  await prisma.businessFact.deleteMany({
    where: { companyId, sourceRef: { startsWith: "graph:" } },
  });

  const now = new Date();
  const companyEntity = await upsertEntity(companyId, {
    type: "company",
    canonicalKey: company.id,
    name: company.name,
    attributes: {
      industry: company.industry,
      country: company.country,
      sizeRange: company.sizeRange,
      employeeCount: company.employeeCount,
      businessModel: company.businessModel,
      customerProfile: company.customerProfile,
    },
  });

  const profileFacts: Array<[string, unknown]> = [
    ["industry", company.industry],
    ["country", company.country],
    ["size_range", company.sizeRange],
    ["employee_count", company.employeeCount],
    ["has_goal", company.objectives],
    ["has_pain_point", company.painPoints],
    ["business_model", company.businessModel],
    ["customer_profile", company.customerProfile],
    ["local_context", company.localContext],
    ["finance_context", company.financeContext],
    ["accounting_context", company.accountingContext],
    ["sales_context", company.salesContext],
    ["marketing_context", company.marketingContext],
    ["hr_context", company.hrContext],
    ["operations_context", company.operationsContext],
    ["automation_score", company.automationScore],
  ];

  for (const [predicate, value] of profileFacts) {
    if (value === null || value === undefined || value === "") continue;
    await addFact(companyId, {
      subjectEntityId: companyEntity.id,
      predicate,
      value,
      sourceProvider: "pilotzia",
      sourceRef: `graph:company:${predicate}`,
      provenance: { method: "company_profile", field: predicate },
    });
  }

  const toolEntities = new Map<string, { id: string; name: string }>();
  const ensureTool = async (toolName: string, detected = false) => {
    const key = slug(toolName);
    const existing = toolEntities.get(key);
    if (existing) return existing;
    const entity = await upsertEntity(companyId, {
      type: "tool",
      canonicalKey: key,
      name: toolName,
      attributes: { detected },
    });
    toolEntities.set(key, { id: entity.id, name: entity.name });
    return { id: entity.id, name: entity.name };
  };

  for (const tool of company.tools) {
    const entity = await ensureTool(tool.name, tool.detected);
    await addFact(companyId, {
      subjectEntityId: companyEntity.id,
      predicate: "uses",
      objectEntityId: entity.id,
      sourceProvider: "pilotzia",
      sourceRef: `graph:tool:${slug(tool.name)}`,
      provenance: { method: tool.detected ? "detected" : "declared" },
    });
  }

  for (const connection of connections) {
    const connectionEntity = await upsertEntity(companyId, {
      type: "connection",
      canonicalKey: connection.provider,
      name: connection.accountLabel || connection.provider,
      status: connection.status,
      attributes: {
        provider: connection.provider,
        permissionMode: connection.permissionMode,
        lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
        hasError: Boolean(connection.lastError),
      },
      seenAt: connection.lastSyncedAt ?? connection.updatedAt,
    });

    await addFact(companyId, {
      subjectEntityId: companyEntity.id,
      predicate: "connected_to",
      objectEntityId: connectionEntity.id,
      sourceProvider: connection.provider,
      sourceRef: `graph:connection:${connection.provider}`,
      observedAt: connection.lastSyncedAt ?? connection.updatedAt,
      provenance: { permissionMode: connection.permissionMode, status: connection.status },
    });

    const providerTools =
      connection.provider === "google" ? ["Gmail", "Google Calendar"] : [connection.provider];
    for (const toolName of providerTools) {
      const tool = await ensureTool(toolName);
      await addFact(companyId, {
        subjectEntityId: connectionEntity.id,
        predicate: "provides",
        objectEntityId: tool.id,
        sourceProvider: connection.provider,
        sourceRef: `graph:connection:${connection.provider}:tool:${slug(toolName)}`,
        observedAt: connection.lastSyncedAt ?? connection.updatedAt,
      });
    }
  }

  for (const automation of automations) {
    const automationEntity = await upsertEntity(companyId, {
      type: "automation",
      canonicalKey: automation.id,
      name: automation.name,
      status: automation.status,
      attributes: {
        businessGoal: automation.businessGoal,
        health: automation.health,
        estimatedHoursPerMonth: automation.estimatedHoursPerMonth,
        estimatedValueEur: automation.estimatedValueEur,
      },
      seenAt: automation.lastCheckedAt,
    });
    await addFact(companyId, {
      subjectEntityId: companyEntity.id,
      predicate: "runs",
      objectEntityId: automationEntity.id,
      sourceProvider: "pilotzia",
      sourceRef: `graph:automation:${automation.id}`,
    });

    for (const toolName of parseStringArray(automation.toolsUsed)) {
      const tool = await ensureTool(toolName);
      await addFact(companyId, {
        subjectEntityId: automationEntity.id,
        predicate: "uses",
        objectEntityId: tool.id,
        sourceProvider: "pilotzia",
        sourceRef: `graph:automation:${automation.id}:tool:${slug(toolName)}`,
      });
    }
  }

  for (const opportunity of opportunities) {
    const opportunityEntity = await upsertEntity(companyId, {
      type: "opportunity",
      canonicalKey: opportunity.id,
      name: opportunity.title,
      status: opportunity.status,
      attributes: {
        category: opportunity.category,
        impactLevel: opportunity.impactLevel,
        complexity: opportunity.complexity,
        estimatedHoursPerMonth: opportunity.estimatedHoursPerMonth,
        estimatedValueEur: opportunity.estimatedValueEur,
      },
      seenAt: opportunity.updatedAt,
    });
    await addFact(companyId, {
      subjectEntityId: companyEntity.id,
      predicate: "has_opportunity",
      objectEntityId: opportunityEntity.id,
      sourceProvider: "pilotzia",
      sourceRef: `graph:opportunity:${opportunity.id}`,
    });
  }

  if (latestGoogleSnapshot?.metadata) {
    try {
      const snapshot = JSON.parse(latestGoogleSnapshot.metadata) as {
        provider?: string;
        unreadInboxLast7Days?: number;
        upcomingEventsNext7Days?: number;
        observedAt?: string;
      };
      if (snapshot.provider === "google") {
        const observedAt = snapshot.observedAt ? new Date(snapshot.observedAt) : latestGoogleSnapshot.createdAt;
        const expiresAt = new Date(observedAt.getTime() + 24 * 60 * 60 * 1000);
        const connectionEntity = await upsertEntity(companyId, {
          type: "connection",
          canonicalKey: "google",
          name: connections.find((item) => item.provider === "google")?.accountLabel || "Google Workspace",
          status: connections.find((item) => item.provider === "google")?.status || "connected",
          seenAt: observedAt,
        });

        const metrics: Array<[string, number | undefined]> = [
          ["unread_inbox_last_7_days", snapshot.unreadInboxLast7Days],
          ["upcoming_events_next_7_days", snapshot.upcomingEventsNext7Days],
        ];
        for (const [predicate, value] of metrics) {
          if (typeof value !== "number") continue;
          await addFact(companyId, {
            subjectEntityId: connectionEntity.id,
            predicate,
            value,
            sourceProvider: "google",
            sourceRef: `graph:google:snapshot:${predicate}`,
            observedAt,
            expiresAt,
            provenance: { method: "api_observation", source: "google_workspace", contentStored: false },
          });
        }
      }
    } catch {
      // Snapshot invalide : on conserve le reste du graphe sans inventer de donnée.
    }
  }


  if (latestHubSpotSnapshot?.metadata) {
    try {
      const snapshot = JSON.parse(latestHubSpotSnapshot.metadata) as {
        provider?: string;
        contactsTotal?: number;
        companiesTotal?: number;
        dealsTotal?: number;
        openDeals?: number;
        wonDeals?: number;
        lostDeals?: number;
        observedAt?: string;
      };
      if (snapshot.provider === "hubspot") {
        const observedAt = snapshot.observedAt ? new Date(snapshot.observedAt) : latestHubSpotSnapshot.createdAt;
        const expiresAt = new Date(observedAt.getTime() + 8 * 24 * 60 * 60 * 1000);
        const connectionEntity = await upsertEntity(companyId, {
          type: "connection",
          canonicalKey: "hubspot",
          name: connections.find((item) => item.provider === "hubspot")?.accountLabel || "HubSpot CRM",
          status: connections.find((item) => item.provider === "hubspot")?.status || "connected",
          seenAt: observedAt,
        });

        const metrics: Array<[string, number | undefined]> = [
          ["contacts_total", snapshot.contactsTotal],
          ["companies_total", snapshot.companiesTotal],
          ["deals_total", snapshot.dealsTotal],
          ["open_deals", snapshot.openDeals],
          ["won_deals", snapshot.wonDeals],
          ["lost_deals", snapshot.lostDeals],
        ];
        for (const [predicate, value] of metrics) {
          if (typeof value !== "number") continue;
          await addFact(companyId, {
            subjectEntityId: connectionEntity.id,
            predicate,
            value,
            sourceProvider: "hubspot",
            sourceRef: `graph:hubspot:snapshot:${predicate}`,
            observedAt,
            expiresAt,
            provenance: { method: "api_observation", source: "hubspot_crm", contentStored: false },
          });
        }
      }
    } catch {
      // Snapshot HubSpot invalide : on conserve le reste du graphe sans inventer de donnée.
    }
  }

  await prisma.event.create({
    data: {
      companyId,
      type: "BUSINESS_GRAPH_REBUILT",
      metadata: json({ managedSource: "pilotzia", builtAt: now.toISOString() }),
    },
  });

  return getBusinessGraphSummary(companyId);
}

export async function getBusinessGraphSummary(companyId: string): Promise<BusinessGraphSummary> {
  const [company, entityCount, factCount, byType, connections, sourceGroups, lastBuilt] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId } }),
    prisma.businessEntity.count({ where: { companyId } }),
    prisma.businessFact.count({ where: { companyId } }),
    prisma.businessEntity.groupBy({ by: ["type"], where: { companyId }, _count: { _all: true } }),
    prisma.integrationConnection.findMany({
      where: { companyId },
      select: { provider: true, status: true, accountLabel: true, lastSyncedAt: true },
    }),
    prisma.businessFact.groupBy({ by: ["sourceProvider"], where: { companyId }, _count: { _all: true } }),
    prisma.event.findFirst({ where: { companyId, type: "BUSINESS_GRAPH_REBUILT" }, orderBy: { createdAt: "desc" } }),
  ]);

  const connected = connections.filter((item) => item.status === "connected");
  const isFreshConnection = (item: (typeof connections)[number]) => {
    if (!item.lastSyncedAt) return false;
    const maxAgeMs = item.provider === "google" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    return item.lastSyncedAt.getTime() >= Date.now() - maxAgeMs;
  };
  const fresh = connected.filter(isFreshConnection);
  const profileFields = [
    company.industry,
    company.country,
    company.sizeRange,
    company.objectives,
    company.painPoints,
    company.businessModel,
    company.customerProfile,
    company.financeContext,
    company.accountingContext,
    company.salesContext,
    company.marketingContext,
    company.hrContext,
    company.operationsContext,
  ];
  const profileScore = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 30);
  const toolsOrGraphScore = entityCount > 1 ? 10 : 0;
  const connectedScore = connected.length > 0 ? 20 : 0;
  const graphCoverageScore = factCount >= 10 ? 15 : factCount >= 3 ? 8 : 0;
  const freshnessScore = connected.length > 0 && fresh.length === connected.length ? 10 : fresh.length > 0 ? 5 : 0;
  const operationalScore = byType.some((item) => item.type === "automation" || item.type === "opportunity") ? 15 : 0;
  const readinessScore = Math.min(100, profileScore + toolsOrGraphScore + connectedScore + graphCoverageScore + freshnessScore + operationalScore);

  return {
    readinessScore,
    entityCount,
    factCount,
    sourceCount: sourceGroups.length,
    connectedSourceCount: connected.length,
    freshSourceCount: fresh.length,
    staleSourceCount: Math.max(0, connected.length - fresh.length),
    entityTypes: byType
      .map((item) => ({ type: item.type, count: item._count._all }))
      .sort((a, b) => b.count - a.count),
    sources: connections.map((item) => ({
      provider: item.provider,
      status: item.status,
      accountLabel: item.accountLabel,
      lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
      fresh: isFreshConnection(item),
    })),
    lastBuiltAt: lastBuilt?.createdAt.toISOString() ?? null,
  };
}

export async function getBusinessGraphContext(companyId: string) {
  let entityCount = await prisma.businessEntity.count({ where: { companyId } });
  if (entityCount === 0) {
    await rebuildBusinessGraph(companyId);
    entityCount = await prisma.businessEntity.count({ where: { companyId } });
  }

  const [summary, entities, facts] = await Promise.all([
    getBusinessGraphSummary(companyId),
    prisma.businessEntity.findMany({
      where: { companyId, status: "active" },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      take: 60,
      select: { id: true, type: true, name: true, confidence: true, lastSeenAt: true },
    }),
    prisma.businessFact.findMany({
      where: { companyId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { observedAt: "desc" },
      take: 100,
      select: {
        subjectEntityId: true,
        predicate: true,
        objectEntityId: true,
        valueJson: true,
        sourceProvider: true,
        sourceRef: true,
        provenanceJson: true,
        confidence: true,
        observedAt: true,
      },
    }),
  ]);

  return {
    summary,
    entities: entities.map((entity) => ({
      ...entity,
      lastSeenAt: entity.lastSeenAt.toISOString(),
    })),
    facts: facts.map((fact) => ({
      ...fact,
      observedAt: fact.observedAt.toISOString(),
    })),
    entityCount,
  };
}
