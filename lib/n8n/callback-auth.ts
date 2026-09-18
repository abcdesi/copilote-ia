import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

// Authentifie les appels entrants depuis n8n (pas une session utilisateur) via un
// secret partagé transmis dans l'en-tête Authorization. L'absence de secret ferme
// systématiquement l'accès et la comparaison évite les écarts temporels triviaux.
export function verifyN8nCallback(req: NextRequest): boolean {
  const expectedSecret = process.env.N8N_CALLBACK_SECRET?.trim();
  if (!expectedSecret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${expectedSecret}`;
  const actualBuffer = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}
