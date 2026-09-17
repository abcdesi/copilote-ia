"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { signIn, signOut } from "@/lib/auth";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(100),
  email: z.string().trim().email("Email invalide").transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(12, "12 caractères minimum")
    .max(128)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Mot de passe trop long"),
  acceptTerms: z.literal("yes"),
});

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms"),
  });

  if (!parsed.success) {
    redirect("/signup?error=invalid");
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (existing) {
    redirect("/signup?error=exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name, email, passwordHash } });

  await track(EVENTS.USER_CREATED, {
    userId: user.id,
    metadata: { acceptedTermsAt: new Date().toISOString(), termsVersion: "2026-09-14" },
  });

  await signIn("credentials", { email, password, redirect: false });

  redirect("/onboarding");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch {
    redirect("/login?error=invalid");
  }

  redirect("/app");
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/");
}
