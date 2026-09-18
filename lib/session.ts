import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE_NAME = "diagnostic_session";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidSessionToken(value?: string | null) {
  return Boolean(value && UUID_RE.test(value));
}

export async function getOrCreateDiagnosticSessionToken(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (isValidSessionToken(existing)) return existing as string;

  const token = randomUUID();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  return token;
}

export async function getDiagnosticSessionToken(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value ?? null;
  return isValidSessionToken(value) ? value : null;
}

export async function clearDiagnosticSessionToken() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
