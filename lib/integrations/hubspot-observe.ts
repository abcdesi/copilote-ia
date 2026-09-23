import { prisma } from "@/lib/db/client";
import { rebuildBusinessGraph } from "@/lib/business-graph";
import { hubSpotApi } from "@/lib/integrations/hubspot";

interface HubSpotSearchResponse {
  total: number;
  results: Array<{
    id: string;
    createdAt?: string;
    updatedAt?: string;
    properties?: Record<string, string | null>;
  }>;
}

export interface HubSpotOperationalSnapshot {
  provider: "hubspot";
  observedAt: string;
  contactsTotal: number;
  companiesTotal: number;
  dealsTotal: number;
  openDeals: number;
  wonDeals: number;
  lostDeals: number;
  contentStored: false;
}

const CRM_SEARCH_ROOT = "https://api.hubapi.com/crm/objects/2026-03";

function searchBody(filters?: Array<{ propertyName: string; operator: string; value: string }>) {
  return JSON.stringify({
    filterGroups: filters?.length ? [{ filters }] : [],
    limit: 1,
    properties: [],
    sorts: [],
  });
}

async function countObjects(
  companyId: string,
  objectType: "contacts" | "companies" | "deals",
  filters?: Array<{ propertyName: string; operator: string; value: string }>
) {
  const response = await hubSpotApi<HubSpotSearchResponse>(
    companyId,
    `${CRM_SEARCH_ROOT}/${objectType}/search`,
    {
      method: "POST",
      body: searchBody(filters),
    }
  );
  return Math.max(0, Number(response.total) || 0);
}

export async function syncHubSpotOperationalSnapshot(
  companyId: string,
  userId: string | null,
  source: "manual" | "oauth_callback" | "scheduled" = "manual"
) {
  const [contactsTotal, companiesTotal, dealsTotal, openDeals, wonDeals, lostDeals] = await Promise.all([
    countObjects(companyId, "contacts"),
    countObjects(companyId, "companies"),
    countObjects(companyId, "deals"),
    countObjects(companyId, "deals", [{ propertyName: "hs_is_closed", operator: "EQ", value: "false" }]),
    countObjects(companyId, "deals", [{ propertyName: "hs_is_closed_won", operator: "EQ", value: "true" }]),
    countObjects(companyId, "deals", [
      { propertyName: "hs_is_closed", operator: "EQ", value: "true" },
      { propertyName: "hs_is_closed_won", operator: "EQ", value: "false" },
    ]),
  ]);

  const snapshot: HubSpotOperationalSnapshot = {
    provider: "hubspot",
    observedAt: new Date().toISOString(),
    contactsTotal,
    companiesTotal,
    dealsTotal,
    openDeals,
    wonDeals,
    lostDeals,
    contentStored: false,
  };

  await prisma.$transaction([
    prisma.integrationConnection.update({
      where: { companyId_provider: { companyId, provider: "hubspot" } },
      data: {
        status: "connected",
        permissionMode: "read_only",
        lastSyncedAt: new Date(snapshot.observedAt),
        lastError: null,
      },
    }),
    prisma.event.create({
      data: {
        companyId,
        userId,
        type: "INTEGRATION_SNAPSHOT",
        metadata: JSON.stringify(snapshot),
      },
    }),
    prisma.event.create({
      data: {
        companyId,
        userId,
        type: "INTEGRATION_SYNCED",
        metadata: JSON.stringify({
          provider: "hubspot",
          source,
          observedAt: snapshot.observedAt,
          metrics: {
            contactsTotal,
            companiesTotal,
            dealsTotal,
            openDeals,
            wonDeals,
            lostDeals,
          },
          contentStored: false,
        }),
      },
    }),
  ]);

  await rebuildBusinessGraph(companyId);
  return snapshot;
}
