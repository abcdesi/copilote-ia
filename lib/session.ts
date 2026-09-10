import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "diagnostic_session";

// Identifiant anonyme (avant inscription) permettant de retrouver puis "réclamer"
// le diagnostic gratuit une fois le compte créé. Ne contient aucune donnée personnelle.
export async function getOrCreateDiagnosticSessionToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  const token = randomUUID();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return token;
}

export async function getDiagnosticSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function clearDiagnosticSessionToken() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
