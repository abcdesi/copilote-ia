"use server";

import { headers } from "next/headers";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { signIn, signOut } from "@/lib/auth";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  hashResetValue,
  sendPasswordResetEmail,
} from "@/lib/auth/password-reset";

const passwordSchema = z
  .string()
  .min(12, "12 caractères minimum")
  .max(128)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Mot de passe trop long");

const signupSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(100),
  email: z.string().trim().email("Email invalide").transform((value) => value.toLowerCase()),
  password: passwordSchema,
  acceptTerms: z.literal("yes"),
});

function safeInternalPath(value: FormDataEntryValue | null, fallback: string) {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\n") || path.includes("\r")) return fallback;
  return path;
}

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms"),
  });

  if (!parsed.success) redirect("/signup?error=invalid");

  const { name, email, password } = parsed.data;
  const next = safeInternalPath(formData.get("next"), "/onboarding");

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing) {
    const suffix = next !== "/onboarding" ? `&next=${encodeURIComponent(next)}` : "";
    redirect(`/signup?error=exists${suffix}`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });

  await track(EVENTS.USER_CREATED, {
    userId: user.id,
    metadata: { acceptedTermsAt: new Date().toISOString(), termsVersion: "2026-09-14" },
  });

  await signIn("credentials", { email, password, redirect: false });
  redirect(next);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeInternalPath(formData.get("next"), "/app");

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch {
    const suffix = next !== "/app" ? `&next=${encodeURIComponent(next)}` : "";
    redirect(`/login?error=invalid${suffix}`);
  }

  redirect(next);
}

export async function requestPasswordResetAction(formData: FormData) {
  const parsed = z.string().trim().email().safeParse(formData.get("email"));
  if (!parsed.success) redirect("/forgot-password?sent=1");
  const email = parsed.data.toLowerCase();
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || headerStore.get("x-real-ip")?.trim() || "unknown";
  const emailType = `PASSWORD_RESET_REQUEST_EMAIL_${hashResetValue(email).slice(0, 32)}`;
  const ipType = `PASSWORD_RESET_REQUEST_IP_${hashResetValue(ip).slice(0, 32)}`;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [emailCount, ipCount] = await Promise.all([
    prisma.event.count({ where: { type: emailType, createdAt: { gte: since } } }),
    prisma.event.count({ where: { type: ipType, createdAt: { gte: since } } }),
  ]);

  if (emailCount < 3 && ipCount < 20) {
    await prisma.$transaction([
      prisma.event.create({ data: { type: emailType } }),
      prisma.event.create({ data: { type: ipType } }),
    ]).catch(() => undefined);

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true },
    });
    if (user) {
      const reset = await createPasswordResetToken(user.id);
      const delivery = await sendPasswordResetEmail({ to: user.email, token: reset.token, idempotencyKey: `password-reset/${reset.tokenHash}` });
      await prisma.event.create({
        data: {
          userId: user.id,
          type: "PASSWORD_RESET_REQUESTED",
          metadata: JSON.stringify({ expiresAt: reset.expiresAt.toISOString(), sent: delivery.sent }),
        },
      }).catch(() => undefined);
    }
  }

  // Réponse identique qu'un compte existe ou non pour ne pas exposer la liste des utilisateurs.
  redirect("/forgot-password?sent=1");
}

export async function resetPasswordAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!/^[0-9a-f]{64}$/i.test(token)) redirect("/forgot-password?error=invalid");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success || password !== confirmation) {
    redirect(`/reset-password/${token}?error=invalid_password`);
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    await consumePasswordResetToken({ token, passwordHash });
  } catch (error) {
    console.error("Password reset failed", error);
    redirect(`/reset-password/${token}?error=invalid`);
  }
  redirect("/login?reset=1");
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/");
}
