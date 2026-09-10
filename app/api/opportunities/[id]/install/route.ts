import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { getTemplateById } from "@/lib/automations/catalog";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return NextResponse.json({ error: "Aucune entreprise associée." }, { status: 404 });

  const opportunity = await prisma.opportunity.findFirst({ where: { id, companyId: company.id } });
  if (!opportunity) return NextResponse.json({ error: "Opportunité introuvable." }, { status: 404 });
  if (opportunity.status === "installed") {
    return NextResponse.json({ error: "Cette automatisation est déjà installée." }, { status: 409 });
  }

  const template = getTemplateById(opportunity.templateId);

  const [, automation] = await prisma.$transaction([
    prisma.purchase.create({
      data: {
        companyId: company.id,
        opportunityId: opportunity.id,
        amountEur: opportunity.priceEur,
        status: "mock_paid",
        provider: "mock",
      },
    }),
    prisma.automation.create({
      data: {
        companyId: company.id,
        opportunityId: opportunity.id,
        name: opportunity.title,
        businessGoal: template?.businessGoal ?? opportunity.description,
        status: "active",
        health: "green",
        toolsUsed: JSON.stringify(template?.relevantTools.slice(0, 3) ?? []),
        estimatedHoursPerMonth: opportunity.estimatedHoursPerMonth,
        estimatedValueEur: opportunity.estimatedValueEur,
      },
    }),
    prisma.opportunity.update({ where: { id: opportunity.id }, data: { status: "installed" } }),
    prisma.company.update({
      where: { id: company.id },
      data: { automationScore: Math.min(95, company.automationScore + 5) },
    }),
  ]);

  await track(EVENTS.AUTOMATION_PURCHASED, {
    companyId: company.id,
    metadata: { opportunityId: opportunity.id, amountEur: opportunity.priceEur },
  });
  await track(EVENTS.AUTOMATION_INSTALLED, { companyId: company.id, metadata: { automationId: automation.id } });

  return NextResponse.json({ automationId: automation.id });
}
