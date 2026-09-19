import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/companies/access";
import { deriveMarketingKpis, getLatestMarketingKpiSnapshot } from "@/lib/marketing/kpis";

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function resolveCompany(userId: string) {
  const cookieStore = await cookies();
  const preferredCompanyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ?? null;

  const memberships = await prisma.companyMembership
    .findMany({
      where: { userId, status: "active" },
      select: {
        companyId: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: "desc" },
    })
    .catch((error) => {
      console.error("Dashboard summary memberships unavailable", error);
      return [];
    });

  const membership =
    (preferredCompanyId ? memberships.find((item) => item.companyId === preferredCompanyId) : null) ??
    memberships[0] ??
    null;

  if (membership) return membership.company;

  return prisma.company
    .findFirst({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    })
    .catch((error) => {
      console.error("Dashboard summary legacy company unavailable", error);
      return null;
    });
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
    }

    const company = await resolveCompany(session.user.id);
    if (!company) {
      return NextResponse.json({ ok: false, reason: "company_not_found" }, { status: 404 });
    }

    const [profile, automations, opportunities, pendingActions, outcomes, marketingSnapshot] =
      await Promise.all([
        prisma.company
          .findUnique({
            where: { id: company.id },
            select: { automationScore: true },
          })
          .catch((error) => {
            console.error("Dashboard summary profile unavailable", error);
            return null;
          }),
        prisma.automation
          .findMany({
            where: { companyId: company.id },
            orderBy: { installedAt: "desc" },
            take: 100,
            select: {
              id: true,
              status: true,
              health: true,
              estimatedHoursPerMonth: true,
              estimatedValueEur: true,
            },
          })
          .catch((error) => {
            console.error("Dashboard summary automations unavailable", error);
            return [];
          }),
        prisma.opportunity
          .findMany({
            where: { companyId: company.id, status: { in: ["detected", "viewed"] } },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              title: true,
              impactLevel: true,
              estimatedHoursPerMonth: true,
              estimatedValueEur: true,
            },
          })
          .catch((error) => {
            console.error("Dashboard summary opportunities unavailable", error);
            return [];
          }),
        prisma.pendingAction
          .findMany({
            where: { companyId: company.id, status: "pending" },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true, title: true, riskLevel: true },
          })
          .catch((error) => {
            console.error("Dashboard summary pending actions unavailable", error);
            return [];
          }),
        prisma.automationOutcome
          .findMany({
            where: { automation: { companyId: company.id } },
            orderBy: { observedAt: "desc" },
            take: 100,
            select: { automationId: true, kind: true, value: true },
          })
          .catch((error) => {
            console.error("Dashboard summary outcomes unavailable", error);
            return [];
          }),
        getLatestMarketingKpiSnapshot(company.id).catch((error) => {
          console.error("Dashboard summary marketing unavailable", error);
          return null;
        }),
      ]);

    const active = automations.filter((item) => item.status === "active");
    const latestOutcomeByMetric = new Map<string, (typeof outcomes)[number]>();
    for (const outcome of outcomes) {
      const key = outcome.automationId + ":" + outcome.kind;
      if (!latestOutcomeByMetric.has(key)) latestOutcomeByMetric.set(key, outcome);
    }
    const latestOutcomes = [...latestOutcomeByMetric.values()];

    const marketingKpis = marketingSnapshot ? deriveMarketingKpis(marketingSnapshot) : null;

    return NextResponse.json({
      ok: true,
      companyName: company.name,
      firstName:
        session.user.name?.trim().split(/\s+/)[0] ||
        session.user.email?.split("@")[0] ||
        company.name,
      automationScore: profile?.automationScore ?? 0,
      pendingActions,
      opportunities,
      activeAutomations: active.length,
      healthyAutomations: active.filter((item) => item.health === "green").length,
      observedHoursPerMonth:
        latestOutcomes
          .filter((item) => item.kind === "time_saved_weekly_hours")
          .reduce((sum, item) => sum + safeNumber(item.value), 0) * 4.33,
      observedValue30d: latestOutcomes
        .filter((item) => item.kind === "value_observed_eur_30d")
        .reduce((sum, item) => sum + safeNumber(item.value), 0),
      estimatedHoursPerMonth: active.reduce(
        (sum, item) => sum + safeNumber(item.estimatedHoursPerMonth),
        0
      ),
      estimatedValuePerMonth: active.reduce(
        (sum, item) => sum + safeNumber(item.estimatedValueEur),
        0
      ),
      marketing: marketingSnapshot
        ? {
            source: marketingSnapshot.source,
            spendEur: marketingSnapshot.spendEur,
            revenueEur: marketingSnapshot.revenueEur,
            roas: marketingKpis?.roas ?? null,
            sessions: marketingSnapshot.sessions,
          }
        : null,
    });
  } catch (error) {
    console.error("Dashboard summary route failed", error);
    return NextResponse.json(
      {
        ok: false,
        reason: "summary_unavailable",
      },
      { status: 200 }
    );
  }
}
