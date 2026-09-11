import { NextRequest } from "next/server";

// Authentifie les appels entrants depuis n8n (pas une session utilisateur) via un
// secret partagé transmis dans l'en-tête Authorization.
export function verifyN8nCallback(req: NextRequest): boolean {
  const expected = process.env.N8N_CALLBACK_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${expected}`;
}
