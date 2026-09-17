import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import type { CompanyRole } from "@/lib/companies/access";

export const INVITABLE_ROLES = ["admin", "operator", "viewer"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://pilotzia.com").replace(/\/$/, "");
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

export async function createCompanyInvitation(input: {
  companyId: string;
  companyName: string;
  inviter: { id: string; name?: string | null; email: string };
  inviterRole: CompanyRole;
  email: string;
  role: InvitableRole;
}) {
  const email = normalizeEmail(input.email);
  if (input.inviterRole === "admin" && input.role === "admin") {
    throw new Error("ROLE_NOT_ALLOWED");
  }

  const existingMember = await prisma.companyMembership.findFirst({
    where: { companyId: input.companyId, status: "active", user: { email } },
    select: { id: true },
  });
  if (existingMember) throw new Error("ALREADY_MEMBER");

  const existingPending = await prisma.companyInvitation.findFirst({
    where: { companyId: input.companyId, email, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  const capacity = await getTeamCapacity(input.companyId);
  const reservedWithoutCurrent = capacity.reservedSeats - (existingPending && existingPending.expiresAt > new Date() ? 1 : 0);
  if (reservedWithoutCurrent >= capacity.seatLimit) throw new Error("SEAT_LIMIT_REACHED");

  if (existingPending) {
    await prisma.companyInvitation.update({
      where: { id: existingPending.id },
      data: { status: "revoked" },
    });
  }

  const token = randomBytes(32).toString("hex");
  const invitation = await prisma.companyInvitation.create({
    data: {
      companyId: input.companyId,
      email,
      role: input.role,
      tokenHash: hashInvitationToken(token),
      status: "pending",
      invitedByUserId: input.inviter.id,
      invitedByName: input.inviter.name ?? null,
      invitedByEmail: normalizeEmail(input.inviter.email),
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    },
  });

  const inviteUrl = `${appBaseUrl()}/invite/${token}`;
  const delivery = await sendInvitationEmail({
    to: email,
    companyName: input.companyName,
    inviterName: input.inviter.name || input.inviter.email,
    role: input.role,
    inviteUrl,
  });

  return { invitation, inviteUrl, delivery };
}

async function sendInvitationEmail(input: {
  to: string;
  companyName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PILOTZIA_TEAM_FROM_EMAIL || process.env.PILOTZIA_SUPPORT_FROM_EMAIL;
  if (!apiKey || !from) return { sent: false as const, reason: "not_configured" as const };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
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
  if (!token || token.length < 32) return null;
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
  const invitation = await getInvitationByToken(input.token);
  if (!invitation || invitation.status !== "pending") throw new Error("INVITATION_INVALID");
  if (normalizeEmail(invitation.email) !== normalizeEmail(input.userEmail)) throw new Error("INVITATION_EMAIL_MISMATCH");

  const capacity = await getTeamCapacity(invitation.companyId);
  const alreadyMember = await prisma.companyMembership.findUnique({
    where: { companyId_userId: { companyId: invitation.companyId, userId: input.userId } },
  });
  if (!alreadyMember && capacity.activeMembers >= capacity.seatLimit) throw new Error("SEAT_LIMIT_REACHED");

  await prisma.$transaction([
    prisma.companyMembership.upsert({
      where: { companyId_userId: { companyId: invitation.companyId, userId: input.userId } },
      create: {
        companyId: invitation.companyId,
        userId: input.userId,
        role: invitation.role,
        status: "active",
      },
      update: { role: invitation.role, status: "active", joinedAt: new Date() },
    }),
    prisma.companyInvitation.update({
      where: { id: invitation.id },
      data: { status: "accepted", acceptedAt: new Date() },
    }),
  ]);

  return { companyId: invitation.companyId, companyName: invitation.company.name, role: invitation.role };
}
