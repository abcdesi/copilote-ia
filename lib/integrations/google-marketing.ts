import { prisma } from "@/lib/db/client";
import {
  GOOGLE_MARKETING_SCOPES,
  getValidGoogleAccessToken,
  parseStoredGoogleScopes,
} from "@/lib/integrations/google";
import { MARKETING_KPI_EVENT, type MarketingKpiSnapshot } from "@/lib/marketing/kpis";

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const GOOGLE_ADS_API_VERSION = "v24";

export interface GoogleMarketingSettings {
  ga4PropertyId?: string;
  googleAdsCustomerId?: string;
  googleAdsLoginCustomerId?: string;
}

export interface Ga4PropertyOption {
  propertyId: string;
  displayName: string;
  accountDisplayName: string;
}

interface Ga4ReportResponse {
  rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
}

interface AdsStreamResponse {
  results?: Array<{
    customer?: { id?: string; currencyCode?: string };
    metrics?: {
      impressions?: string;
      clicks?: string;
      costMicros?: string;
      conversions?: number | string;
      conversionsValue?: number | string;
    };
  }>;
}

function parseSettings(value: string | null | undefined): GoogleMarketingSettings {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      ga4PropertyId: typeof parsed.ga4PropertyId === "string" ? parsed.ga4PropertyId : undefined,
      googleAdsCustomerId:
        typeof parsed.googleAdsCustomerId === "string" ? parsed.googleAdsCustomerId : undefined,
      googleAdsLoginCustomerId:
        typeof parsed.googleAdsLoginCustomerId === "string" ? parsed.googleAdsLoginCustomerId : undefined,
    };
  } catch {
    return {};
  }
}

function cleanDigits(value: string | undefined) {
  return value?.replace(/\D/g, "") || undefined;
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function googleFetch(companyId: string, url: string, init: RequestInit = {}) {
  const token = await getValidGoogleAccessToken(companyId);
  const response = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Marketing API ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response;
}

export async function getGoogleMarketingState(companyId: string) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { companyId_provider: { companyId, provider: "google" } },
  });
  const scopes = parseStoredGoogleScopes(connection?.scopes);
  const settings = parseSettings(connection?.settingsJson);
  return {
    connection,
    scopes,
    settings,
    analyticsAuthorized: Boolean(connection?.status === "connected" && scopes.includes(GA4_SCOPE)),
    adsAuthorized: Boolean(connection?.status === "connected" && scopes.includes(GOOGLE_ADS_SCOPE)),
    adsServerConfigured: Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()),
  };
}

export async function saveGoogleMarketingSettings(
  companyId: string,
  settings: GoogleMarketingSettings
) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { companyId_provider: { companyId, provider: "google" } },
    select: { settingsJson: true },
  });
  if (!connection) throw new Error("Google doit d'abord être autorisé.");

  const previous = parseSettings(connection.settingsJson);
  const next: GoogleMarketingSettings = {
    ...previous,
    ...settings,
    ga4PropertyId: cleanDigits(settings.ga4PropertyId ?? previous.ga4PropertyId),
    googleAdsCustomerId: cleanDigits(settings.googleAdsCustomerId ?? previous.googleAdsCustomerId),
    googleAdsLoginCustomerId: cleanDigits(
      settings.googleAdsLoginCustomerId ?? previous.googleAdsLoginCustomerId
    ),
  };

  await prisma.integrationConnection.update({
    where: { companyId_provider: { companyId, provider: "google" } },
    data: { settingsJson: JSON.stringify(next), lastError: null },
  });
  return next;
}

export async function listGa4Properties(companyId: string): Promise<Ga4PropertyOption[]> {
  const state = await getGoogleMarketingState(companyId);
  if (!state.analyticsAuthorized) return [];

  const response = await googleFetch(
    companyId,
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200"
  );
  const data = (await response.json()) as {
    accountSummaries?: Array<{
      displayName?: string;
      propertySummaries?: Array<{ property?: string; displayName?: string }>;
    }>;
  };

  return (data.accountSummaries ?? []).flatMap((account) =>
    (account.propertySummaries ?? [])
      .map((property) => {
        const propertyId = property.property?.replace(/^properties\//, "") ?? "";
        return {
          propertyId,
          displayName: property.displayName || propertyId,
          accountDisplayName: account.displayName || "Google Analytics",
        };
      })
      .filter((property) => Boolean(property.propertyId))
  );
}

async function fetchGa4Metrics(companyId: string, propertyId: string) {
  const response = await googleFetch(
    companyId,
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      body: JSON.stringify({
        dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "keyEvents" },
          { name: "totalRevenue" },
        ],
        currencyCode: "EUR",
        limit: 1,
      }),
    }
  );
  const data = (await response.json()) as Ga4ReportResponse;
  const metrics = data.rows?.[0]?.metricValues ?? [];
  return {
    sessions: safeNumber(metrics[0]?.value),
    users: safeNumber(metrics[1]?.value),
    keyEvents: safeNumber(metrics[2]?.value),
    totalRevenueEur: safeNumber(metrics[3]?.value),
  };
}

async function fetchGoogleAdsMetrics(
  companyId: string,
  settings: GoogleMarketingSettings
) {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const customerId = cleanDigits(settings.googleAdsCustomerId);
  if (!developerToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN manquant.");
  if (!customerId) throw new Error("Identifiant client Google Ads manquant.");

  const token = await getValidGoogleAccessToken(companyId);
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "developer-token": developerToken,
  };
  const loginCustomerId = cleanDigits(settings.googleAdsLoginCustomerId);
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const response = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        query:
          "SELECT customer.id, customer.currency_code, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM customer WHERE segments.date DURING LAST_30_DAYS",
      }),
    }
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Ads API ${response.status}: ${detail.slice(0, 400)}`);
  }

  const batches = (await response.json()) as AdsStreamResponse[];
  let impressions = 0;
  let clicks = 0;
  let costMicros = 0;
  let conversions = 0;
  let conversionsValue = 0;
  let currencyCode: string | null = null;

  for (const batch of batches) {
    for (const row of batch.results ?? []) {
      impressions += safeNumber(row.metrics?.impressions);
      clicks += safeNumber(row.metrics?.clicks);
      costMicros += safeNumber(row.metrics?.costMicros);
      conversions += safeNumber(row.metrics?.conversions);
      conversionsValue += safeNumber(row.metrics?.conversionsValue);
      currencyCode = row.customer?.currencyCode ?? currencyCode;
    }
  }

  return {
    impressions,
    clicks,
    spend: costMicros / 1_000_000,
    conversions,
    conversionsValue,
    currencyCode,
  };
}

export async function syncGoogleMarketingSnapshot(
  companyId: string,
  actorUserId?: string | null,
  source: "manual" | "oauth_callback" | "scheduled" = "manual"
) {
  const state = await getGoogleMarketingState(companyId);
  if (!state.connection || state.connection.status !== "connected") {
    throw new Error("Google Marketing n'est pas connecté.");
  }

  const providers: string[] = [];
  const errors: string[] = [];
  let ga4: Awaited<ReturnType<typeof fetchGa4Metrics>> | null = null;
  let ads: Awaited<ReturnType<typeof fetchGoogleAdsMetrics>> | null = null;

  if (state.analyticsAuthorized && state.settings.ga4PropertyId) {
    try {
      ga4 = await fetchGa4Metrics(companyId, state.settings.ga4PropertyId);
      providers.push("ga4");
    } catch (error) {
      errors.push("ga4:" + (error instanceof Error ? error.message.slice(0, 240) : "erreur inconnue"));
    }
  }

  if (
    state.adsAuthorized &&
    state.adsServerConfigured &&
    state.settings.googleAdsCustomerId
  ) {
    try {
      ads = await fetchGoogleAdsMetrics(companyId, state.settings);
      providers.push("google_ads");
    } catch (error) {
      errors.push(
        "google_ads:" + (error instanceof Error ? error.message.slice(0, 240) : "erreur inconnue")
      );
    }
  }

  if (!ga4 && !ads) {
    const detail = errors.length ? errors.join(" | ") : "Aucune source marketing configurée.";
    await prisma.integrationConnection.update({
      where: { companyId_provider: { companyId, provider: "google" } },
      data: { lastError: detail.slice(0, 500) },
    });
    throw new Error(detail);
  }

  const adsIsEur = ads?.currencyCode === "EUR";
  const snapshot: MarketingKpiSnapshot = {
    source: "google_marketing",
    observedAt: new Date().toISOString(),
    periodDays: 30,
    spendEur: ads && adsIsEur ? ads.spend : null,
    leads: null,
    conversions: ads?.conversions ?? ga4?.keyEvents ?? null,
    customers: null,
    revenueEur: ga4?.totalRevenueEur ?? null,
    attributedRevenueEur: ads && adsIsEur ? ads.conversionsValue : null,
    sessions: ga4?.sessions ?? null,
    users: ga4?.users ?? null,
    clicks: ads?.clicks ?? null,
    impressions: ads?.impressions ?? null,
    currencyCode: ads?.currencyCode ?? (ga4 ? "EUR" : null),
    providers,
  };

  const observedAt = new Date(snapshot.observedAt);
  await prisma.$transaction([
    prisma.event.create({
      data: {
        companyId,
        userId: actorUserId ?? null,
        type: MARKETING_KPI_EVENT,
        metadata: JSON.stringify({
          ...snapshot,
          syncSource: source,
          providerErrors: errors,
          ga4PropertyId: state.settings.ga4PropertyId ?? null,
          googleAdsCustomerId: state.settings.googleAdsCustomerId ?? null,
        }),
      },
    }),
    prisma.integrationConnection.update({
      where: { companyId_provider: { companyId, provider: "google" } },
      data: {
        lastSyncedAt: observedAt,
        lastError: errors.length ? errors.join(" | ").slice(0, 500) : null,
      },
    }),
  ]);

  return { snapshot, errors };
}

export function googleMarketingScopesGranted(scopes: string | null | undefined) {
  const granted = parseStoredGoogleScopes(scopes);
  return {
    analytics: granted.includes(GA4_SCOPE),
    ads: granted.includes(GOOGLE_ADS_SCOPE),
    all: GOOGLE_MARKETING_SCOPES.every((scope) => granted.includes(scope)),
  };
}
