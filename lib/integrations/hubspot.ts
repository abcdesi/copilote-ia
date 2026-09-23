import { createHmac, timingSafeEqual } from "crypto";
import { decrypt, encrypt } from "@/lib/crypto/encryption";
import { prisma } from "@/lib/db/client";

const HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/2026-03/token";
const HUBSPOT_REVOKE_URL = "https://api.hubapi.com/oauth/2026-03/token/revoke";

export const HUBSPOT_READ_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
] as const;

export type HubSpotConfigurationStatus = { configured: boolean; missing: string[] };

export function getHubSpotConfigurationStatus(): HubSpotConfigurationStatus {
  const missing: string[] = [];
  if (!process.env.HUBSPOT_CLIENT_ID) missing.push("HUBSPOT_CLIENT_ID");
  if (!process.env.HUBSPOT_CLIENT_SECRET) missing.push("HUBSPOT_CLIENT_SECRET");
  if (!process.env.APP_URL) missing.push("APP_URL");
  if (!process.env.OAUTH_STATE_SECRET && !process.env.AUTH_SECRET) missing.push("OAUTH_STATE_SECRET/AUTH_SECRET");

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) missing.push("ENCRYPTION_KEY");
  else {
    try {
      if (Buffer.from(encryptionKey, "base64").length !== 32) missing.push("ENCRYPTION_KEY(32_bytes)");
    } catch {
      missing.push("ENCRYPTION_KEY(base64)");
    }
  }

  return { configured: missing.length === 0, missing };
}

function env(name: "HUBSPOT_CLIENT_ID" | "HUBSPOT_CLIENT_SECRET" | "APP_URL") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} manquante.`);
  return value;
}

function stateSecret() {
  return process.env.OAUTH_STATE_SECRET || process.env.AUTH_SECRET || "";
}

function sign(value: string) {
  const secret = stateSecret();
  if (!secret) throw new Error("OAUTH_STATE_SECRET ou AUTH_SECRET manquant.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createHubSpotState(companyId: string) {
  const payload = Buffer.from(JSON.stringify({ companyId, ts: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyHubSpotState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("État OAuth HubSpot invalide.");

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Signature OAuth HubSpot invalide.");

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    companyId: string;
    ts: number;
  };
  if (!parsed.companyId || Date.now() - parsed.ts > 10 * 60 * 1000) throw new Error("État OAuth HubSpot expiré.");
  return parsed;
}

export function hubSpotRedirectUri() {
  return `${env("APP_URL").replace(/\/$/, "")}/api/integrations/hubspot/callback`;
}

export function buildHubSpotAuthorizationUrl(companyId: string) {
  const configuration = getHubSpotConfigurationStatus();
  if (!configuration.configured) {
    throw new Error(`Configuration HubSpot incomplète: ${configuration.missing.join(", ")}`);
  }

  const url = new URL(HUBSPOT_AUTH_URL);
  url.searchParams.set("client_id", env("HUBSPOT_CLIENT_ID"));
  url.searchParams.set("redirect_uri", hubSpotRedirectUri());
  url.searchParams.set("scope", HUBSPOT_READ_SCOPES.join(" "));
  url.searchParams.set("state", createHubSpotState(companyId));
  return url.toString();
}

type HubSpotTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  hub_id?: number;
  scopes?: string[];
};

async function exchangeToken(body: URLSearchParams) {
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Échange OAuth HubSpot impossible (${response.status}): ${detail.slice(0, 240)}`);
  }
  return response.json() as Promise<HubSpotTokenResponse>;
}

export function exchangeHubSpotCode(code: string) {
  return exchangeToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env("HUBSPOT_CLIENT_ID"),
      client_secret: env("HUBSPOT_CLIENT_SECRET"),
      redirect_uri: hubSpotRedirectUri(),
      code,
    })
  );
}

async function refreshHubSpotToken(refreshToken: string) {
  return exchangeToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env("HUBSPOT_CLIENT_ID"),
      client_secret: env("HUBSPOT_CLIENT_SECRET"),
      refresh_token: refreshToken,
    })
  );
}

export async function upsertHubSpotConnection(companyId: string, tokens: HubSpotTokenResponse) {
  const existing = await prisma.integrationConnection.findUnique({
    where: { companyId_provider: { companyId, provider: "hubspot" } },
  });
  const scopes = tokens.scopes?.length ? tokens.scopes : [...HUBSPOT_READ_SCOPES];
  const hubId = tokens.hub_id ? String(tokens.hub_id) : existing?.externalAccountId ?? null;

  return prisma.integrationConnection.upsert({
    where: { companyId_provider: { companyId, provider: "hubspot" } },
    create: {
      companyId,
      provider: "hubspot",
      accountLabel: hubId ? `HubSpot #${hubId}` : "Compte HubSpot",
      externalAccountId: hubId,
      status: "connected",
      permissionMode: "read_only",
      scopes: JSON.stringify(scopes),
      accessTokenEncrypted: encrypt(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      lastSyncedAt: null,
      lastError: null,
    },
    update: {
      accountLabel: hubId ? `HubSpot #${hubId}` : existing?.accountLabel ?? "Compte HubSpot",
      externalAccountId: hubId,
      status: "connected",
      permissionMode: "read_only",
      scopes: JSON.stringify(scopes),
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

  const stillValid = connection.expiresAt && connection.expiresAt.getTime() > Date.now() + 90_000;
  if (stillValid) return decrypt(connection.accessTokenEncrypted);

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
        status: "connected",
        scopes: JSON.stringify(refreshed.scopes?.length ? refreshed.scopes : JSON.parse(connection.scopes)),
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

export async function hubSpotApi<T>(companyId: string, url: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidHubSpotAccessToken(companyId);
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
    const message = `HubSpot API ${response.status}: ${detail.slice(0, 240)}`;
    await prisma.integrationConnection.updateMany({
      where: { companyId, provider: "hubspot" },
      data: {
        status: response.status === 401 ? "needs_reauth" : "connected",
        lastError: message.slice(0, 500),
      },
    });
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function revokeHubSpotRefreshToken(refreshToken: string) {
  const response = await fetch(HUBSPOT_REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token: refreshToken,
      token_type_hint: "refresh_token",
      client_id: env("HUBSPOT_CLIENT_ID"),
      client_secret: env("HUBSPOT_CLIENT_SECRET"),
    }),
  });
  return response.ok;
}
