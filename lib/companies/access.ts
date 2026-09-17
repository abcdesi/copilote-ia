import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export type CompanyRole = "owner" | "admin" | "operator" | "viewer";
export type CompanyPermission =
  | "view"
  | "edit_company"
  | "manage_contacts"
  | "operate_automations"
  | "configure_automations"
  | "approve_low_risk"
  | "approve_medium_risk"
  | "approve_high_risk"
  | "manage_team"
  | "manage_billing";

const ROLE_PERMISSIONS: Record<CompanyRole, ReadonlySet<CompanyPermission>> = {
  owner: new Set([
    "view",
    "edit_company",
    "manage_contacts",
    "operate_automations",
    "configure_automations",
    "approve_low_risk",
    "approve_medium_risk",
    "approve_high_risk",
    "manage_team",
    "manage_billing",
  ]),
  admin: new Set([
    "view",
    "edit_company",
    "manage_contacts",
    "operate_automations",
    "configure_automations",
    "approve_low_risk",
    "approve_medium_risk",
    "manage_team",
  ]),
  operator: new Set([
    "view",
    "manage_contacts",
    "operate_automations",
    "approve_low_risk",
  ]),
  viewer: new Set(["view"]),
};

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  operator: "Opérateur",
  viewer: "Lecteur",
};

export function normalizeCompanyRole(role?: string | null): CompanyRole {
  if (role === "owner" || role === "admin" || role === "operator" || role === "viewer") return role;
  return "viewer";
}

export function hasCompanyPermission(role: CompanyRole, permission: CompanyPermission) {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function canApproveRisk(role: CompanyRole, riskLevel: string) {
  if (riskLevel === "high") return hasCompanyPermission(role, "approve_high_risk");
  if (riskLevel === "medium") return hasCompanyPermission(role, "approve_medium_risk");
  return hasCompanyPermission(role, "approve_low_risk");
}

async function requireAuthenticatedSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function getCurrentCompanyAccess() {
  const session = await requireAuthenticatedSession();
  const membership = await prisma.companyMembership.findFirst({
    where: { userId: session.user.id, status: "active" },
    include: {
      company: {
        include: { tools: true, subscriptions: true },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  if (membership) {
    return {
      session,
      company: membership.company,
      membershipId: membership.id,
      role: normalizeCompanyRole(membership.role),
    };
  }

  // Compatibilité avec les comptes créés avant l'introduction des memberships.
  const legacyCompany = await prisma.company.findFirst({
    where: { userId: session.user.id },
    include: { tools: true, subscriptions: true },
    orderBy: { createdAt: "desc" },
  });
  if (!legacyCompany) redirect("/onboarding");

  const legacyMembership = await prisma.companyMembership.upsert({
    where: { companyId_userId: { companyId: legacyCompany.id, userId: session.user.id } },
    create: { companyId: legacyCompany.id, userId: session.user.id, role: "owner", status: "active" },
    update: { role: "owner", status: "active" },
  });

  return {
    session,
    company: legacyCompany,
    membershipId: legacyMembership.id,
    role: "owner" as const,
  };
}

export async function requireCompanyPermission(permission: CompanyPermission) {
  const access = await getCurrentCompanyAccess();
  if (!hasCompanyPermission(access.role, permission)) {
    throw new Error("COMPANY_PERMISSION_DENIED");
  }
  return access;
}
