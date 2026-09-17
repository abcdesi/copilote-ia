import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { SITE_URL } from "@/lib/config";

const RESET_TTL_MS = 30 * 60 * 1000;

export function hashResetValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function tokenEventType(tokenHash: string) {
  return `PASSWORD_RESET_TOKEN_${tokenHash}`;
}

function usedEventType(tokenHash: string) {
  return `PASSWORD_RESET_USED_${tokenHash}`;
}

export function passwordResetCompletionType(userId: string) {
  return `PASSWORD_RESET_COMPLETED_${hashResetValue(userId).slice(0, 32)}`;
}

export async function createPasswordResetToken(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetValue(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await prisma.event.create({
    data: {
      userId,
      type: tokenEventType(tokenHash),
      metadata: JSON.stringify({ expiresAt: expiresAt.toISOString() }),
    },
  });
  return { token, tokenHash, expiresAt };
}

export async function validatePasswordResetToken(token: string) {
  if (!/^[0-9a-f]{64}$/i.test(token)) return null;
  const tokenHash = hashResetValue(token);
  const [issued, used] = await Promise.all([
    prisma.event.findFirst({ where: { type: tokenEventType(tokenHash) }, orderBy: { createdAt: "desc" } }),
    prisma.event.findFirst({ where: { type: usedEventType(tokenHash) }, select: { id: true } }),
  ]);
  if (!issued?.userId || used) return null;
  try {
    const metadata = issued.metadata ? JSON.parse(issued.metadata) as { expiresAt?: string } : {};
    const expiresAt = metadata.expiresAt ? new Date(metadata.expiresAt) : new Date(issued.createdAt.getTime() + RESET_TTL_MS);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) return null;
    return { userId: issued.userId, tokenHash, expiresAt };
  } catch {
    return null;
  }
}

export async function consumePasswordResetToken(input: { token: string; passwordHash: string }) {
  const initial = await validatePasswordResetToken(input.token);
  if (!initial) throw new Error("RESET_INVALID");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const used = await tx.event.findFirst({ where: { type: usedEventType(initial.tokenHash) }, select: { id: true } });
          if (used) throw new Error("RESET_INVALID");
          const issued = await tx.event.findFirst({
            where: { type: tokenEventType(initial.tokenHash), userId: initial.userId },
            orderBy: { createdAt: "desc" },
          });
          if (!issued) throw new Error("RESET_INVALID");
          const metadata = issued.metadata ? JSON.parse(issued.metadata) as { expiresAt?: string } : {};
          const expiresAt = metadata.expiresAt ? new Date(metadata.expiresAt) : new Date(issued.createdAt.getTime() + RESET_TTL_MS);
          if (expiresAt <= new Date()) throw new Error("RESET_INVALID");

          await tx.user.update({ where: { id: initial.userId }, data: { passwordHash: input.passwordHash } });
          await tx.event.create({ data: { userId: initial.userId, type: usedEventType(initial.tokenHash), metadata: issued.id } });
          await tx.event.create({
            data: {
              userId: initial.userId,
              type: passwordResetCompletionType(initial.userId),
              metadata: JSON.stringify({ resetTokenEventId: issued.id }),
            },
          });
          return { userId: initial.userId };
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
      if (code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("RESET_INVALID");
}

export async function sendPasswordResetEmail(input: { to: string; token: string; idempotencyKey: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PILOTZIA_AUTH_FROM_EMAIL || process.env.PILOTZIA_SUPPORT_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false as const, reason: "not_configured" as const };

  const resetUrl = `${SITE_URL}/reset-password/${input.token}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Réinitialiser votre mot de passe Pilotzia",
      text: [
        "Une demande de réinitialisation du mot de passe Pilotzia a été reçue.",
        "",
        `Choisir un nouveau mot de passe : ${resetUrl}`,
        "",
        "Ce lien est valable 30 minutes et ne peut être utilisé qu'une fois.",
        "Si vous n'avez pas demandé cette modification, ignorez cet email.",
      ].join("\n"),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Password reset email failed", response.status, detail.slice(0, 300));
    return { sent: false as const, reason: "provider_error" as const };
  }
  return { sent: true as const };
}

export async function latestPasswordResetAt(userId: string) {
  const event = await prisma.event.findFirst({
    where: { type: passwordResetCompletionType(userId) },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return event?.createdAt ?? null;
}
