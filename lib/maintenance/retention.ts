import { prisma } from "@/lib/db/client";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runDataRetentionMaintenance(now = new Date()) {
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * DAY_MS);

  const [diagnostics, shortNoise, authNoise, expiredInvitations] = await prisma.$transaction([
    // Les diagnostics publics non revendiqués peuvent contenir du texte libre saisi
    // avant création de compte. Ils ne deviennent mémoire entreprise que s'ils sont réclamés.
    prisma.diagnostic.deleteMany({
      where: {
        companyId: null,
        claimedAt: null,
        createdAt: { lt: thirtyDaysAgo },
      },
    }),
    // Tokens/hash de déduplication : aucune valeur probatoire durable.
    prisma.event.deleteMany({
      where: {
        createdAt: { lt: sevenDaysAgo },
        OR: [
          { type: { startsWith: "PUBLIC_DIAGNOSTIC_IP_" } },
          { type: { startsWith: "SUPPORT_DUPLICATE_" } },
          { type: { startsWith: "PASSWORD_RESET_REQUEST_EMAIL_" } },
          { type: { startsWith: "PASSWORD_RESET_REQUEST_IP_" } },
          { type: { startsWith: "PASSWORD_RESET_TOKEN_" } },
          { type: { startsWith: "PASSWORD_RESET_USED_" } },
        ],
      },
    }),
    // Les tentatives de connexion sont pseudonymisées et conservées plus longtemps
    // pour l'investigation d'abus, sans encombrer indéfiniment le journal métier.
    prisma.event.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
        OR: [
          { type: { startsWith: "AUTH_LOGIN_FAILED_EMAIL_" } },
          { type: { startsWith: "AUTH_LOGIN_FAILED_PAIR_" } },
        ],
      },
    }),
    prisma.companyInvitation.updateMany({
      where: { status: "pending", expiresAt: { lt: now } },
      data: { status: "expired" },
    }),
  ]);

  return {
    deletedUnclaimedDiagnostics: diagnostics.count,
    deletedShortLivedSecurityEvents: shortNoise.count,
    deletedOldAuthFailures: authNoise.count,
    expiredInvitations: expiredInvitations.count,
  };
}
