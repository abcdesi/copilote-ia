import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { getTemplateById } from "@/lib/automations/catalog";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { isN8nConfigured, createWorkflow, activateWorkflow } from "@/lib/n8n/client";
import { buildContactListWorkflow } from "@/lib/n8n/workflows";
import { isRealExecutionTemplate } from "@/lib/n8n/real-execution-config";

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
        templateId: opportunity.templateId,
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

  if (isRealExecutionTemplate(opportunity.templateId) && isN8nConfigured()) {
    try {
      const workflow = await createWorkflow(buildContactListWorkflow(company.id, opportunity.templateId));
      await activateWorkflow(workflow.id);
      await prisma.automation.update({ where: { id: automation.id }, data: { n8nWorkflowId: workflow.id } });
    } catch (err) {
      // L'automatisation reste installée (simulée) même si la mise en place de
      // l'exécution réelle échoue — on ne bloque jamais l'utilisateur là-dessus.
      console.error("n8n workflow creation failed:", err);
    }
  }

  return NextResponse.json({ automationId: automation.id });
}
