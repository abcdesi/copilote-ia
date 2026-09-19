import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db/client";
import { decrypt, encrypt } from "@/lib/crypto/encryption";

function appUrl() {
  const value = process.env.APP_URL?.trim();
  if (!value) throw new Error("APP_URL manquante.");
  return value.replace(/\/$/, "");
}

export function stripeBusinessWebhookUrl(companyId: string) {
  return `${appUrl()}/api/integrations/stripe-business/webhook/${encodeURIComponent(companyId)}`;
}

export async function upsertStripeBusinessWebhookConnection(input: {
  companyId: string;
  webhookSecret: string;
}) {
  const secret = input.webhookSecret.trim();
  if (!secret.startsWith("whsec_") || secret.length < 16) {
    throw new Error("Secret webhook Stripe invalide.");
  }

  return prisma.integrationConnection.upsert({
    where: { companyId_provider: { companyId: input.companyId, provider: "stripe_business" } },
    create: {
      companyId: input.companyId,
      provider: "stripe_business",
      accountLabel: "Stripe métier · factures payées",
      status: "connected",
      permissionMode: "read_only",
      scopes: JSON.stringify(["invoice.paid"]),
      accessTokenEncrypted: encrypt(secret),
      refreshTokenEncrypted: null,
      expiresAt: null,
      lastError: null,
    },
    update: {
      accountLabel: "Stripe métier · factures payées",
      status: "connected",
      permissionMode: "read_only",
      scopes: JSON.stringify(["invoice.paid"]),
      accessTokenEncrypted: encrypt(secret),
      refreshTokenEncrypted: null,
      expiresAt: null,
      lastError: null,
    },
  });
}

export async function getStripeBusinessWebhookSecret(companyId: string) {
  const connection = await prisma.integrationConnection.findUnique({
    where: { companyId_provider: { companyId, provider: "stripe_business" } },
  });
  if (!connection || connection.status !== "connected") throw new Error("Stripe métier n'est pas connecté.");
  return decrypt(connection.accessTokenEncrypted);
}

export function verifyStripeWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
}) {
  if (!input.signatureHeader || !input.secret) return false;
  const parts = input.signatureHeader.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;

  const expected = createHmac("sha256", input.secret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);

  return signatures.some((signature) => {
    const candidate = Buffer.from(signature);
    return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
  });
}
