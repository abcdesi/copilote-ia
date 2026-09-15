import { createHmac, timingSafeEqual } from "crypto";

function shareSecret() {
  const secret = process.env.DIAGNOSTIC_SHARE_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("DIAGNOSTIC_SHARE_SECRET ou AUTH_SECRET manquant.");
  return secret;
}

function signatureFor(diagnosticId: string) {
  return createHmac("sha256", shareSecret()).update(`pilotzia-diagnostic:${diagnosticId}`).digest("base64url");
}

export function createDiagnosticShareToken(diagnosticId: string) {
  return `${diagnosticId}.${signatureFor(diagnosticId)}`;
}

export function verifyDiagnosticShareToken(token: string) {
  const split = token.lastIndexOf(".");
  if (split <= 0) return null;
  const diagnosticId = token.slice(0, split);
  const signature = token.slice(split + 1);
  if (!diagnosticId || !signature) return null;

  const expected = signatureFor(diagnosticId);
  const candidateBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (candidateBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(candidateBuffer, expectedBuffer)) return null;
  return diagnosticId;
}
