import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db/client";
import { decrypt, encrypt } from "@/lib/crypto/encryption";

const HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/2026-03/token";

export const HUBSPOT_SCOPES = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.deals.read",
];

function appUrl() {
  const value = process.env.APP_URL?.trim();
  if (!value) throw new Error("APP_URL manquante.");
  return value.replace(/\/$/, "");
}

function clientId() {
  const value = process.env.HUBSPOT_CLIENT_ID?.trim();
  if (!value) throw new Error("HUBSPOT_CLIENT_ID manquant.");
  return value;
}

function clientSecret() {
  const value = process.env.HUBSPOT_CLIENT_SECRET?.trim();
  if (!value) throw new Error("HUBSPOT_CLIENT_SECRET manquant.");
  return value;
}

function stateSecret() {
  const value = process.env.OAUTH_STATE_SECRET || process.env.AUTH_SECRET;
  if (!value) throw new Error("OAUTH_STATE_SECRET ou AUTH_SECRET manquant.");
  return value;
}

function signState(payload: string) {
  return createHmac("sha256", stateSecret()).update(`hubspot:${payload}`).digest("base64url");
}

export function getHubSpotConfigurationStatus() {
  const missing: string[] = [];
  if (!process.env.HUBSPOT_CLIENT_ID) missing.push("HUBSPOT_CLIENT_ID");
  if (!process.env.HUBSPOT_CLIENT_SECRET) missing.push("HUBSPOT_CLIENT_SECRET");
  if (!process.env.APP_URL) missing.push("APP_URL");
  if (!process.env.OAUTH_STATE_SECRET && !process.env.AUTH_SECRET) missing.push("OAUTH_STATE_SECRET/AUTH_SECRET");
  if (!process.env.ENCRYPTION_KEY) missing.push("ENCRYPTION_KEY");
  return { configured: missing.length === 0, missing };
}

export function hubspotRedirectUri() {
  return process.env.HUBSPOT_REDIRECT_URI?.trim() || `${appUrl()}/api/integrations/hubspot/callback`;
}

export function hubspotWebhookUrl() {
  return `${appUrl()}/api/integrations/hubspot/webhook`;
}

export function createHubSpotState(companyId: string) {
  const payload = Buffer.from(JSON.stringify({ companyId, ts: Date.now() })).toString("base64url");
  return `${payload}.${signState(payload)}`;
}

export function verifyHubSpotState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("État OAuth HubSpot invalide.");
  const expected = signState(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error("Signature OAuth HubSpot invalide.");
  }
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    companyId?: string;
    ts?: number;
  };
  if (!parsed.companyId || !parsed.ts || Date.now() - parsed.ts > 10 * 60 * 1000) {
    throw new Error("État OAuth HubSpot expiré.");
  }
  return { companyId: parsed.companyId };
}

export function buildHubSpotAuthorizationUrl(companyId: string) {
  const configuration = getHubSpotConfigurationStatus();
  if (!configuration.configured) {
    throw new Error(`Configuration HubSpot incomplète: ${configuration.missing.join(", ")}`);
  }
  const url = new URL(HUBSPOT_AUTH_URL);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", hubspotRedirectUri());
  url.searchParams.set("scope", HUBSPOT_SCOPES.join(" "));
  url.searchParams.set("state", createHubSpotState(companyId));
  return url.toString();
}

type HubSpotTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  hub_id?: number | string;
  scopes?: string[];
  scope?: string;
};

async function hubspotToken(body: URLSearchParams) {
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Échange OAuth HubSpot impossible (${res.status}): ${detail.slice(0, 240)}`);
  }
  return res.json() as Promise<HubSpotTokenResponse>;
}

export async function exchangeHubSpotCode(code: string) {
  return hubspotToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: hubspotRedirectUri(),
      code,
    })
  );
}

async function refreshHubSpotToken(refreshToken: string) {
  return hubspotToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: refreshToken,
    })
  );
}

function grantedScopes(tokens: HubSpotTokenResponse) {
  if (Array.isArray(tokens.scopes)) return tokens.scopes.filter(Boolean);
  if (tokens.scope) return tokens.scope.split(/[\s,]+/).filter(Boolean);
  return HUBSPOT_SCOPES;
}

export async function upsertHubSpotConnection(companyId: string, tokens: HubSpotTokenResponse) {
  const existing = await prisma.integrationConnection.findUnique({
    where: { companyId_provider: { companyId, provider: "hubspot" } },
  });
  const hubId = tokens.hub_id != null ? String(tokens.hub_id) : existing?.externalAccountId ?? null;
  if (!hubId) throw new Error("HubSpot n'a pas renvoyé l'identifiant du portail autorisé.");

  return prisma.integrationConnection.upsert({
    where: { companyId_provider: { companyId, provider: "hubspot" } },
    create: {
      companyId,
      provider: "hubspot",
      accountLabel: `HubSpot · portail ${hubId}`,
      externalAccountId: hubId,
      status: "connected",
      permissionMode: "read_only",
      scopes: JSON.stringify(grantedScopes(tokens)),
      accessTokenEncrypted: encrypt(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      lastError: null,
    },
    update: {
      accountLabel: `HubSpot · portail ${hubId}`,
      externalAccountId: hubId,
      status: "connected",
      permissionMode: "read_only",
      scopes: JSON.stringify(grantedScopes(tokens)),
      accessTokenEncrypted: encrypt(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : existing?.refreshTokenEncrypted,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      lastError: null,
    },
  });
}

export async function getValidHubSpotAccessToken(companyId: string) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { companyId_provider: { companyId, provider: "hubspot" } },
  });
  if (!connection || connection.status === "disconnected") throw new Error("HubSpot n'est pas connecté.");

  if (connection.expiresAt && connection.expiresAt.getTime() > Date.now() + 60_000) {
    return decrypt(connection.accessTokenEncrypted);
  }
  if (!connection.refreshTokenEncrypted) {
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { status: "needs_reauth", lastError: "Jeton de renouvellement HubSpot absent." },
    });
    throw new Error("HubSpot doit être reconnecté.");
  }

  try {
    const refreshed = await refreshHubSpotToken(decrypt(connection.refreshTokenEncrypted));
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEncrypted: encrypt(refreshed.access_token),
        refreshTokenEncrypted: refreshed.refresh_token
          ? encrypt(refreshed.refresh_token)
          : connection.refreshTokenEncrypted,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        scopes: JSON.stringify(grantedScopes(refreshed)),
        status: "connected",
        lastError: null,
      },
    });
    return refreshed.access_token;
  } catch (error) {
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        status: "needs_reauth",
        lastError: error instanceof Error ? error.message.slice(0, 500) : "Rafraîchissement HubSpot impossible.",
      },
    });
    throw error;
  }
}

export async function hubspotApi<T>(companyId: string, path: string, init: RequestInit = {}) {
  const token = await getValidHubSpotAccessToken(companyId);
  const res = await fetch(`https://api.hubapi.com${path}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    await prisma.integrationConnection.updateMany({
      where: { companyId, provider: "hubspot" },
      data: {
        status: res.status === 401 ? "needs_reauth" : "connected",
        lastError: `HubSpot API ${res.status}: ${detail.slice(0, 300)}`,
      },
    });
    throw new Error(`HubSpot API ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

function decodeHubSpotSignatureUri(uri: string) {
  const replacements: Record<string, string> = {
    "%3A": ":",
    "%2F": "/",
    "%3F": "?",
    "%40": "@",
    "%21": "!",
    "%24": "$",
    "%27": "'",
    "%28": "(",
    "%29": ")",
    "%2A": "*",
    "%2C": ",",
    "%3B": ";",
  };
  return Object.entries(replacements).reduce(
    (value, [encoded, decoded]) => value.replace(new RegExp(encoded, "gi"), decoded),
    uri
  );
}

export function verifyHubSpotWebhookSignatureV3(input: {
  method: string;
  url: string;
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
}) {
  if (!input.timestamp || !input.signature) return false;
  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) return false;

  const source = `${input.method.toUpperCase()}${decodeHubSpotSignatureUri(input.url)}${input.rawBody}${input.timestamp}`;
  const expected = createHmac("sha256", clientSecret()).update(source, "utf8").digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(input.signature);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
