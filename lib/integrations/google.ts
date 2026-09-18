import { createHmac, timingSafeEqual } from "crypto";
import { decrypt, encrypt } from "@/lib/crypto/encryption";
import { prisma } from "@/lib/db/client";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export const GOOGLE_ACTION_SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/calendar.events",
];

export type GoogleAuthorizationMode = "observe" | "action";
export type GoogleConfigurationStatus = { configured: boolean; missing: string[] };

export function getGoogleConfigurationStatus(): GoogleConfigurationStatus {
  const missing: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
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

function env(name: "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "APP_URL") {
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

export function createGoogleState(companyId: string, mode: GoogleAuthorizationMode = "observe") {
  const payload = Buffer.from(JSON.stringify({ companyId, mode, ts: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyGoogleState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("État OAuth invalide.");
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Signature OAuth invalide.");
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    companyId: string;
    mode?: GoogleAuthorizationMode;
    ts: number;
  };
  if (!parsed.companyId || Date.now() - parsed.ts > 10 * 60 * 1000) throw new Error("État OAuth expiré.");
  return { ...parsed, mode: parsed.mode === "action" ? ("action" as const) : ("observe" as const) };
}

export function googleRedirectUri() {
  return `${env("APP_URL").replace(/\/$/, "")}/api/integrations/google/callback`;
}

export function buildGoogleAuthorizationUrl(companyId: string, mode: GoogleAuthorizationMode = "observe") {
  const configuration = getGoogleConfigurationStatus();
  if (!configuration.configured) throw new Error(`Configuration Google incomplète: ${configuration.missing.join(", ")}`);

  const scopes = mode === "action" ? [...GOOGLE_SCOPES, ...GOOGLE_ACTION_SCOPES] : GOOGLE_SCOPES;
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", env("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", createGoogleState(companyId, mode));
  return url.toString();
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Échange OAuth Google impossible (${res.status}): ${detail.slice(0, 180)}`);
  }
  return res.json() as Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
    token_type: string;
  }>;
}

export async function getGoogleUser(accessToken: string) {
  const res = await fetch(GOOGLE_USERINFO_URL, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Profil Google inaccessible (${res.status}).`);
  return res.json() as Promise<{ sub: string; email?: string; name?: string }>;
}

function parseGrantedScopes(scope?: string) {
  return (scope ?? GOOGLE_SCOPES.join(" ")).split(" ").filter(Boolean);
}

export async function upsertGoogleConnection(companyId: string, tokens: Awaited<ReturnType<typeof exchangeGoogleCode>>) {
  const user = await getGoogleUser(tokens.access_token);
  const existing = await prisma.integrationConnection.findUnique({
    where: { companyId_provider: { companyId, provider: "google" } },
  });
  const grantedScopes = parseGrantedScopes(tokens.scope);
  const actionEnabled = GOOGLE_ACTION_SCOPES.every((scope) => grantedScopes.includes(scope));

  return prisma.integrationConnection.upsert({
    where: { companyId_provider: { companyId, provider: "google" } },
    create: {
      companyId,
      provider: "google",
      accountLabel: user.email ?? user.name ?? "Compte Google",
      externalAccountId: user.sub,
      status: "connected",
      permissionMode: actionEnabled ? "read_action_confirm" : "read_only",
      scopes: JSON.stringify(grantedScopes),
      accessTokenEncrypted: encrypt(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      lastSyncedAt: null,
      lastError: null,
    },
    update: {
      accountLabel: user.email ?? user.name ?? existing?.accountLabel ?? "Compte Google",
      externalAccountId: user.sub,
      status: "connected",
      permissionMode: actionEnabled ? "read_action_confirm" : "read_only",
      scopes: JSON.stringify(grantedScopes),
      accessTokenEncrypted: encrypt(tokens.access_token),
      refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : existing?.refreshTokenEncrypted,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      lastError: null,
    },
  });
}

export async function hasGoogleScopes(companyId: string, requiredScopes: readonly string[]) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { companyId_provider: { companyId, provider: "google" } },
    select: { status: true, scopes: true },
  });
  if (!connection || connection.status !== "connected") return false;
  try {
    const granted = JSON.parse(connection.scopes) as string[];
    return requiredScopes.every((scope) => granted.includes(scope));
  } catch {
    return false;
  }
}

async function refreshGoogleToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Rafraîchissement Google impossible (${res.status}): ${detail.slice(0, 180)}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number; scope?: string }>;
}

export async function getValidGoogleAccessToken(companyId: string) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { companyId_provider: { companyId, provider: "google" } },
  });
  if (!connection || connection.status === "disconnected") throw new Error("Google n'est pas connecté.");

  const stillValid = connection.expiresAt && connection.expiresAt.getTime() > Date.now() + 60_000;
  if (stillValid) return decrypt(connection.accessTokenEncrypted);
  if (!connection.refreshTokenEncrypted) {
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { status: "needs_reauth", lastError: "Jeton de renouvellement Google absent." },
    });
    throw new Error("Google doit être reconnecté.");
  }

  try {
    const refreshed = await refreshGoogleToken(decrypt(connection.refreshTokenEncrypted));
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEncrypted: encrypt(refreshed.access_token),
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
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
        lastError: error instanceof Error ? error.message.slice(0, 500) : "Rafraîchissement Google impossible.",
      },
    });
    throw error;
  }
}

export async function googleApi<T>(companyId: string, url: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidGoogleAccessToken(companyId);
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const detail = `Google API ${res.status}: ${text.slice(0, 240)}`;
    await prisma.integrationConnection.updateMany({
      where: { companyId, provider: "google" },
      data: {
        status: res.status === 401 ? "needs_reauth" : "connected",
        lastError: detail.slice(0, 500),
      },
    });
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}
