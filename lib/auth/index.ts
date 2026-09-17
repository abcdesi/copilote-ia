import { createHash } from "node:crypto";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";
import { latestPasswordResetAt } from "@/lib/auth/password-reset";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_PAIR_FAILURES = 8;
const MAX_EMAIL_FAILURES = 30;

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function clientIp(request?: Request) {
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request?.headers.get("x-real-ip")?.trim() || "unknown";
}

function failureTypes(email: string, request?: Request) {
  const ip = clientIp(request);
  return {
    emailType: `AUTH_LOGIN_FAILED_EMAIL_${hashKey(email)}`,
    pairType: `AUTH_LOGIN_FAILED_PAIR_${hashKey(`${email}|${ip}`)}`,
  };
}

async function isLoginRateLimited(email: string, request?: Request) {
  const { emailType, pairType } = failureTypes(email, request);
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [pairFailures, emailFailures] = await Promise.all([
    prisma.event.count({ where: { type: pairType, createdAt: { gte: since } } }),
    prisma.event.count({ where: { type: emailType, createdAt: { gte: since } } }),
  ]);
  return pairFailures >= MAX_PAIR_FAILURES || emailFailures >= MAX_EMAIL_FAILURES;
}

async function recordLoginFailure(email: string, request?: Request) {
  const { emailType, pairType } = failureTypes(email, request);
  await prisma.$transaction([
    prisma.event.create({ data: { type: emailType, metadata: JSON.stringify({ reason: "invalid_credentials" }) } }),
    prisma.event.create({ data: { type: pairType, metadata: JSON.stringify({ reason: "invalid_credentials" }) } }),
  ]);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials, request) => {
        const email = normalizeEmail(credentials?.email);
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        if (await isLoginRateLimited(email, request)) return null;

        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        if (!user) {
          await bcrypt.hash(password, 10);
          await recordLoginFailure(email, request);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await recordLoginFailure(email, request);
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const typed = token as typeof token & { id?: string; authenticatedAt?: number; authInvalidated?: boolean };
      if (user) {
        typed.id = user.id;
        typed.authenticatedAt = Date.now();
        typed.authInvalidated = false;
        return typed;
      }

      if (typed.id && !typed.authInvalidated) {
        const resetAt = await latestPasswordResetAt(typed.id).catch(() => null);
        const authenticatedAt = typed.authenticatedAt ?? (typeof token.iat === "number" ? token.iat * 1000 : 0);
        if (resetAt && resetAt.getTime() > authenticatedAt) {
          typed.id = undefined;
          typed.authInvalidated = true;
        }
      }
      return typed;
    },
    session({ session, token }) {
      if (session.user) {
        const typed = token as typeof token & { id?: string; authInvalidated?: boolean };
        session.user.id = typed.authInvalidated ? "" : typed.id ?? "";
      }
      return session;
    },
  },
});
