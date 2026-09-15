import { createHmac, timingSafeEqual } from "crypto";

function shareSecret() {
  const secret = process.env.DIAGNOSTIC_SHARE_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("DIAGNOSTIC_SHARE_SECRET ou AUTH_SECRET manquant.");
  return secret;
}

function shareTtlDays() {
  const parsed = Number(process.env.PILOTZIA_DIAGNOSTIC_SHARE_TTL_DAYS || "30");
  return Number.isFinite(parsed) ? Math.max(1, Math.min(365, Math.round(parsed))) : 30;
}

function signatureFor(diagnosticId: string, expiresAtUnix: string) {
  return createHmac("sha256", shareSecret())
    .update(`pilotzia-diagnostic:${diagnosticId}:${expiresAtUnix}`)
    .digest("base64url");
}

export function createDiagnosticShareToken(diagnosticId: string) {
  const expiresAtUnix = String(Math.floor(Date.now() / 1000) + shareTtlDays() * 86400);
  return `${diagnosticId}.${expiresAtUnix}.${signatureFor(diagnosticId, expiresAtUnix)}`;
}

export function verifyDiagnosticShareToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [diagnosticId, expiresAtUnix, signature] = parts;
  if (!diagnosticId || !expiresAtUnix || !signature) return null;

  const expiresAt = Number(expiresAtUnix);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return null;

  const expected = signatureFor(diagnosticId, expiresAtUnix);
  const candidateBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (candidateBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(candidateBuffer, expectedBuffer)) return null;
  return diagnosticId;
}
