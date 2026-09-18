import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import type { CompanyRole } from "@/lib/companies/access";
import { SITE_URL } from "@/lib/config";

export const INVITABLE_ROLES = ["admin", "operator", "viewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function prismaCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
}

export async function getTeamCapacity(companyId: string) {
  const [entitlements, activeMembers, pendingInvitations] = await Promise.all([
    getCompanyEntitlements(companyId),
    prisma.companyMembership.count({ where: { companyId, status: "active" } }),
    prisma.companyInvitation.count({
      where: { companyId, status: "pending", expiresAt: { gt: new Date() } },
    }),
  ]);
  return {
    seatLimit: entitlements.seatLimit,
    activeMembers,
    pendingInvitations,
    reservedSeats: activeMembers + pendingInvitations,
    seatsAvailable: Math.max(0, entitlements.seatLimit - activeMembers - pendingInvitations),
    plan: entitlements.plan,
  };
}

export async function getTeamOverview(companyId: string) {
  const [capacity, members, invitations] = await Promise.all([
    getTeamCapacity(companyId),
    prisma.companyMembership.findMany({
      where: { companyId, status: "active" },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
    }),
    prisma.companyInvitation.findMany({
      where: { companyId, status: "pending", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        invitedByName: true,
        invitedByEmail: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
  ]);
  return { capacity, members, invitations };
}

export async function createCompanyInvitation(input: {
  companyId: string;
  companyName: string;
  inviter: { id: string; name?: string | null; email: string };
  inviterRole: CompanyRole;
  email: string;
  role: InvitableRole;
}) {
  const email = normalizeEmail(input.email);
  if (input.inviterRole !== "owner" && input.role === "admin") throw new Error("ROLE_NOT_ALLOWED");
  if (email === normalizeEmail(input.inviter.email)) throw new Error("ALREADY_MEMBER");

  const entitlements = await getCompanyEntitlements(input.companyId);
  let created: Awaited<ReturnType<typeof prisma.companyInvitation.create>> | null = null;
  let token = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const existingMember = await tx.companyMembership.findFirst({
            where: {
              companyId: input.companyId,
              status: "active",
              user: { email: { equals: email, mode: "insensitive" } },
            },
            select: { id: true },
          });
          if (existingMember) throw new Error("ALREADY_MEMBER");

          const existingPending = await tx.companyInvitation.findFirst({
            where: { companyId: input.companyId, email, status: "pending" },
            orderBy: { createdAt: "desc" },
          });
          const [activeMembers, pendingInvitations] = await Promise.all([
            tx.companyMembership.count({ where: { companyId: input.companyId, status: "active" } }),
            tx.companyInvitation.count({
              where: { companyId: input.companyId, status: "pending", expiresAt: { gt: new Date() } },
            }),
          ]);
          const existingReservesSeat = Boolean(existingPending && existingPending.expiresAt > new Date());
          const reservedWithoutCurrent = activeMembers + pendingInvitations - (existingReservesSeat ? 1 : 0);
          if (reservedWithoutCurrent >= entitlements.seatLimit) throw new Error("SEAT_LIMIT_REACHED");

          if (existingPending) {
            await tx.companyInvitation.update({ where: { id: existingPending.id }, data: { status: "revoked" } });
          }

          const plainToken = randomBytes(32).toString("hex");
          const invitation = await tx.companyInvitation.create({
            data: {
              companyId: input.companyId,
              email,
              role: input.role,
              tokenHash: hashInvitationToken(plainToken),
              status: "pending",
              invitedByUserId: input.inviter.id,
              invitedByName: input.inviter.name ?? null,
              invitedByEmail: normalizeEmail(input.inviter.email),
              expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
            },
          });
          await tx.event.create({
            data: {
              companyId: input.companyId,
              userId: input.inviter.id,
              type: "TEAM_INVITATION_CREATED",
              metadata: JSON.stringify({
                invitationId: invitation.id,
                invitedEmail: email,
                role: input.role,
                inviterRole: input.inviterRole,
                expiresAt: invitation.expiresAt.toISOString(),
              }),
            },
          });
          return { invitation, plainToken };
        },
        { isolationLevel: "Serializable" }
      );
      created = result.invitation;
      token = result.plainToken;
      break;
    } catch (error) {
      if (prismaCode(error) === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  if (!created || !token) throw new Error("INVITATION_CREATE_FAILED");

  const inviteUrl = `${SITE_URL}/invite/${token}`;
  const delivery = await sendInvitationEmail({
    to: email,
    companyName: input.companyName,
    inviterName: input.inviter.name || input.inviter.email,
    role: input.role,
    inviteUrl,
    idempotencyKey: `team-invite/${created.id}`,
  });
  await prisma.event.create({
    data: {
      companyId: input.companyId,
      userId: input.inviter.id,
      type: "TEAM_INVITATION_DELIVERY",
      metadata: JSON.stringify({ invitationId: created.id, sent: delivery.sent, reason: "reason" in delivery ? delivery.reason : null }),
    },
  }).catch(() => undefined);

  return { invitation: created, inviteUrl, delivery };
}

async function sendInvitationEmail(input: {
  to: string;
  companyName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
  idempotencyKey: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PILOTZIA_TEAM_FROM_EMAIL || process.env.PILOTZIA_SUPPORT_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false as const, reason: "not_configured" as const };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `${input.inviterName} vous invite sur Pilotzia — ${input.companyName}`,
      text: [
        `Vous avez été invité(e) à rejoindre ${input.companyName} sur Pilotzia.`,
        `Rôle proposé : ${input.role}.`,
        "",
        `Accepter l'invitation : ${input.inviteUrl}`,
        "",
        "Ce lien est valable 7 jours. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.",
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Team invitation email failed", res.status, detail.slice(0, 300));
    return { sent: false as const, reason: "provider_error" as const };
  }
  return { sent: true as const };
}

export async function getInvitationByToken(token: string) {
  if (!/^[0-9a-f]{64}$/i.test(token)) return null;
  const invitation = await prisma.companyInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!invitation) return null;
  if (invitation.status === "pending" && invitation.expiresAt <= new Date()) {
    await prisma.companyInvitation.update({ where: { id: invitation.id }, data: { status: "expired" } });
    return { ...invitation, status: "expired" };
  }
  return invitation;
}

export async function acceptInvitationForUser(input: { token: string; userId: string; userEmail: string }) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const invitation = await tx.companyInvitation.findUnique({
            where: { tokenHash: hashInvitationToken(input.token) },
            include: { company: { select: { id: true, name: true, additionalSeats: true } } },
          });
          if (!invitation || invitation.status !== "pending" || invitation.expiresAt <= new Date()) {
            throw new Error("INVITATION_INVALID");
          }
          if (normalizeEmail(invitation.email) !== normalizeEmail(input.userEmail)) throw new Error("INVITATION_EMAIL_MISMATCH");

          const planSubscription = await tx.subscription.findFirst({
            where: { companyId: invitation.companyId },
            orderBy: { createdAt: "desc" },
            select: { plan: true, status: true },
          });
          const plan = planSubscription && ["active", "trialing"].includes(planSubscription.status) ? planSubscription.plan : "free";
          const seatLimit = plan === "business"
            ? 10 + Math.max(0, invitation.company.additionalSeats)
            : plan === "pro"
              ? 3
              : 1;
          const existingMembership = await tx.companyMembership.findUnique({
            where: { companyId_userId: { companyId: invitation.companyId, userId: input.userId } },
          });
          const activeMembers = await tx.companyMembership.count({ where: { companyId: invitation.companyId, status: "active" } });
          const consumesNewSeat = !existingMembership || existingMembership.status !== "active";
          if (consumesNewSeat && activeMembers >= seatLimit) throw new Error("SEAT_LIMIT_REACHED");

          const membership = await tx.companyMembership.upsert({
            where: { companyId_userId: { companyId: invitation.companyId, userId: input.userId } },
            create: {
              companyId: invitation.companyId,
              userId: input.userId,
              role: invitation.role,
              status: "active",
            },
            update: { role: invitation.role, status: "active", joinedAt: new Date() },
          });
          await tx.companyInvitation.update({
            where: { id: invitation.id },
            data: { status: "accepted", acceptedAt: new Date() },
          });
          await tx.event.create({
            data: {
              companyId: invitation.companyId,
              userId: input.userId,
              type: "TEAM_INVITATION_ACCEPTED",
              metadata: JSON.stringify({
                invitationId: invitation.id,
                membershipId: membership.id,
                role: invitation.role,
                invitedByUserId: invitation.invitedByUserId,
              }),
            },
          });
          return { companyId: invitation.companyId, companyName: invitation.company.name, role: invitation.role };
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      if (prismaCode(error) === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("INVITATION_ACCEPT_FAILED");
}
