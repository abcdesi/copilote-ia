import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export const ACTIVE_COMPANY_COOKIE = "pilotzia_active_company";

export type CompanyRole = "owner" | "admin" | "operator" | "viewer";
export type CompanyPermission =
  | "view"
  | "edit_company"
  | "manage_contacts"
  | "manage_documents"
  | "operate_automations"
  | "configure_automations"
  | "approve_low_risk"
  | "approve_medium_risk"
  | "approve_high_risk"
  | "manage_integrations"
  | "sync_integrations"
  | "manage_team"
  | "manage_billing";

const ROLE_PERMISSIONS: Record<CompanyRole, ReadonlySet<CompanyPermission>> = {
  owner: new Set([
    "view", "edit_company", "manage_contacts", "manage_documents", "operate_automations", "configure_automations",
    "approve_low_risk", "approve_medium_risk", "approve_high_risk", "manage_integrations", "sync_integrations", "manage_team", "manage_billing",
  ]),
  admin: new Set([
    "view", "edit_company", "manage_contacts", "manage_documents", "operate_automations", "configure_automations",
    "approve_low_risk", "approve_medium_risk", "manage_integrations", "sync_integrations", "manage_team",
  ]),
  operator: new Set(["view", "manage_contacts", "manage_documents", "operate_automations", "approve_low_risk", "sync_integrations"]),
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
  if (riskLevel === "critical") return role === "owner";
  if (riskLevel === "high") return hasCompanyPermission(role, "approve_high_risk");
  if (riskLevel === "medium") return hasCompanyPermission(role, "approve_medium_risk");
  if (riskLevel === "low") return hasCompanyPermission(role, "approve_low_risk");
  return false;
}

async function requireAuthenticatedSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session;
}

export async function getCompanyChoices(userId: string) {
  const memberships = await prisma.companyMembership.findMany({
    where: { userId, status: "active" },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "desc" },
  });
  return memberships.map((membership) => ({
    companyId: membership.companyId,
    companyName: membership.company.name,
    role: normalizeCompanyRole(membership.role),
  }));
}

export async function getDashboardShellAccess() {
  const session = await requireAuthenticatedSession();
  const cookieStore = await cookies();
  const preferredCompanyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ?? null;

  let memberships: Array<{
    id: string;
    companyId: string;
    role: string;
    company: { id: string; name: string };
  }> = [];

  try {
    memberships = await prisma.companyMembership.findMany({
      where: { userId: session.user.id, status: "active" },
      select: {
        id: true,
        companyId: true,
        role: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: "desc" },
    });
  } catch (error) {
    console.error("Company memberships unavailable in dashboard shell", error);
  }

  const membership =
    (preferredCompanyId ? memberships.find((item) => item.companyId === preferredCompanyId) : null) ??
    memberships[0] ??
    null;

  if (membership) {
    return {
      session,
      company: membership.company,
      membershipId: membership.id,
      role: normalizeCompanyRole(membership.role),
      companyChoices: memberships.map((item) => ({
        companyId: item.companyId,
        companyName: item.company.name,
        role: normalizeCompanyRole(item.role),
      })),
    };
  }

  const legacyCompany = await prisma.company
    .findFirst({
      where: { userId: session.user.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    })
    .catch((error) => {
      console.error("Legacy company lookup unavailable in dashboard shell", error);
      return null;
    });

  if (!legacyCompany) redirect("/onboarding");

  return {
    session,
    company: legacyCompany,
    membershipId: null,
    role: "owner" as const,
    companyChoices: [{ companyId: legacyCompany.id, companyName: legacyCompany.name, role: "owner" as const }],
  };
}

export async function getCurrentCompanyAccess() {
  const session = await requireAuthenticatedSession();
  const cookieStore = await cookies();
  const preferredCompanyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ?? null;

  const memberships = await prisma.companyMembership.findMany({
    where: { userId: session.user.id, status: "active" },
    include: {
      company: {
        include: {
          tools: true,
          subscriptions: { orderBy: { createdAt: "desc" } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const membership =
    (preferredCompanyId ? memberships.find((item) => item.companyId === preferredCompanyId) : null) ?? memberships[0] ?? null;
  if (membership) {
    return {
      session,
      company: membership.company,
      membershipId: membership.id,
      role: normalizeCompanyRole(membership.role),
      companyChoices: memberships.map((item) => ({
        companyId: item.companyId,
        companyName: item.company.name,
        role: normalizeCompanyRole(item.role),
      })),
    };
  }

  const legacyCompany = await prisma.company.findFirst({
    where: { userId: session.user.id },
    include: {
      tools: true,
      subscriptions: { orderBy: { createdAt: "desc" } },
    },
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
    companyChoices: [{ companyId: legacyCompany.id, companyName: legacyCompany.name, role: "owner" as const }],
  };
}

export async function requireCompanyPermission(permission: CompanyPermission) {
  const access = await getCurrentCompanyAccess();
  if (!hasCompanyPermission(access.role, permission)) throw new Error("COMPANY_PERMISSION_DENIED");
  return access;
}
