"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getCurrentCompanyAccess, hasCompanyPermission, normalizeCompanyRole } from "@/lib/companies/access";
import { requireSession } from "@/lib/companies/current";
import { acceptInvitationForUser, createCompanyInvitation, INVITABLE_ROLES } from "@/lib/companies/team";

const inviteSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(INVITABLE_ROLES),
});

function teamError(code: string) {
  redirect(`/app/team?error=${encodeURIComponent(code)}`);
}

export async function inviteTeamMemberAction(formData: FormData) {
  const access = await getCurrentCompanyAccess();
  if (!hasCompanyPermission(access.role, "manage_team")) teamError("forbidden");
  if (!access.session.user.email) teamError("account_incomplete");

  const parsed = inviteSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) teamError("invalid_invitation");

  try {
    const result = await createCompanyInvitation({
      companyId: access.company.id,
      companyName: access.company.name,
      inviter: {
        id: access.session.user.id,
        name: access.session.user.name,
        email: access.session.user.email,
      },
      inviterRole: access.role,
      email: parsed.data.email,
      role: parsed.data.role,
    });

    if (!result.delivery.sent) {
      await prisma.companyInvitation.update({ where: { id: result.invitation.id }, data: { status: "delivery_failed" } });
      await prisma.event.create({
        data: {
          companyId: access.company.id,
          userId: access.session.user.id,
          type: "TEAM_INVITATION_DELIVERY_FAILED",
          metadata: JSON.stringify({ invitationId: result.invitation.id, email: parsed.data.email }),
        },
      }).catch(() => undefined);
      teamError("delivery_failed");
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "invitation_failed";
    if (["ROLE_NOT_ALLOWED", "ALREADY_MEMBER", "SEAT_LIMIT_REACHED"].includes(code)) teamError(code.toLowerCase());
    console.error("Team invitation failed", error);
    teamError("invitation_failed");
  }

  revalidatePath("/app/team");
  redirect("/app/team?invited=1");
}

export async function revokeTeamInvitationAction(formData: FormData) {
  const access = await getCurrentCompanyAccess();
  if (!hasCompanyPermission(access.role, "manage_team")) teamError("forbidden");
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) teamError("invalid_invitation");

  const invitation = await prisma.companyInvitation.findFirst({
    where: { id: invitationId, companyId: access.company.id, status: "pending" },
  });
  if (!invitation) teamError("invitation_not_found");
  if (access.role !== "owner" && invitation.role === "admin") teamError("forbidden");

  await prisma.$transaction([
    prisma.companyInvitation.update({ where: { id: invitation.id }, data: { status: "revoked" } }),
    prisma.event.create({
      data: {
        companyId: access.company.id,
        userId: access.session.user.id,
        type: "TEAM_INVITATION_REVOKED",
        metadata: JSON.stringify({ invitationId: invitation.id, email: invitation.email, role: invitation.role, actorRole: access.role }),
      },
    }),
  ]);
  revalidatePath("/app/team");
}

const memberRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(INVITABLE_ROLES),
});

export async function updateTeamMemberRoleAction(formData: FormData) {
  const access = await getCurrentCompanyAccess();
  if (!hasCompanyPermission(access.role, "manage_team")) teamError("forbidden");
  const parsed = memberRoleSchema.safeParse({ membershipId: formData.get("membershipId"), role: formData.get("role") });
  if (!parsed.success) teamError("invalid_member");

  const target = await prisma.companyMembership.findFirst({
    where: { id: parsed.data.membershipId, companyId: access.company.id, status: "active" },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!target) teamError("member_not_found");
  const targetRole = normalizeCompanyRole(target.role);
  if (targetRole === "owner" || target.userId === access.session.user.id) teamError("forbidden");
  if (access.role !== "owner" && (targetRole === "admin" || parsed.data.role === "admin")) teamError("forbidden");

  await prisma.$transaction([
    prisma.companyMembership.update({ where: { id: target.id }, data: { role: parsed.data.role } }),
    prisma.event.create({
      data: {
        companyId: access.company.id,
        userId: access.session.user.id,
        type: "TEAM_MEMBER_ROLE_CHANGED",
        metadata: JSON.stringify({
          targetUserId: target.userId,
          targetEmail: target.user.email,
          previousRole: targetRole,
          nextRole: parsed.data.role,
          actorRole: access.role,
        }),
      },
    }),
  ]);
  revalidatePath("/app/team");
}

export async function removeTeamMemberAction(formData: FormData) {
  const access = await getCurrentCompanyAccess();
  if (!hasCompanyPermission(access.role, "manage_team")) teamError("forbidden");
  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) teamError("invalid_member");

  const target = await prisma.companyMembership.findFirst({
    where: { id: membershipId, companyId: access.company.id, status: "active" },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!target) teamError("member_not_found");
  const targetRole = normalizeCompanyRole(target.role);
  if (targetRole === "owner" || target.userId === access.session.user.id) teamError("forbidden");
  if (access.role !== "owner" && targetRole === "admin") teamError("forbidden");

  await prisma.$transaction([
    prisma.companyMembership.update({ where: { id: target.id }, data: { status: "removed" } }),
    prisma.event.create({
      data: {
        companyId: access.company.id,
        userId: access.session.user.id,
        type: "TEAM_MEMBER_REMOVED",
        metadata: JSON.stringify({ targetUserId: target.userId, targetEmail: target.user.email, targetRole, actorRole: access.role }),
      },
    }),
  ]);
  revalidatePath("/app/team");
}

export async function acceptTeamInvitationAction(formData: FormData) {
  const session = await requireSession();
  const token = String(formData.get("token") ?? "");
  if (!/^[0-9a-f]{64}$/i.test(token) || !session.user.email) redirect(`/invite/${encodeURIComponent(token)}?error=invalid`);

  try {
    await acceptInvitationForUser({ token, userId: session.user.id, userEmail: session.user.email });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVITATION_INVALID";
    const publicCode =
      code === "INVITATION_EMAIL_MISMATCH" ? "email_mismatch" : code === "SEAT_LIMIT_REACHED" ? "seat_limit" : "invalid";
    redirect(`/invite/${token}?error=${publicCode}`);
  }
  redirect("/app?joined=1");
}
