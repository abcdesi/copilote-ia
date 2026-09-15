import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { getTemplateById } from "@/lib/automations/catalog";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { isN8nConfigured, createWorkflow, activateWorkflow } from "@/lib/n8n/client";
import { buildContactListWorkflow } from "@/lib/n8n/workflows";
import { isRealExecutionTemplate } from "@/lib/n8n/real-execution-config";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return NextResponse.json({ error: "Aucune entreprise associée." }, { status: 404 });

  const entitlements = await getCompanyEntitlements(company.id);
  if (!entitlements.canExecute) {
    return NextResponse.json(
      {
        error: "L'exécution réelle des automatisations est incluse à partir de l'offre Action.",
        upgradeRequired: true,
        href: "/app/settings",
      },
      { status: 403 }
    );
  }

  const opportunity = await prisma.opportunity.findFirst({ where: { id, companyId: company.id } });
  if (!opportunity) return NextResponse.json({ error: "Opportunité introuvable." }, { status: 404 });
  if (opportunity.status === "installed") {
    return NextResponse.json({ error: "Cette automatisation est déjà installée." }, { status: 409 });
  }

  if (!isRealExecutionTemplate(opportunity.templateId)) {
    return NextResponse.json(
      {
        error: "Cette recommandation est encore disponible en simulation uniquement. Pilotzia ne la présente pas comme exécutable tant que son connecteur réel n'est pas prêt.",
      },
      { status: 409 }
    );
  }
  if (!isN8nConfigured()) {
    return NextResponse.json(
      { error: "Le moteur d'exécution n'est pas configuré. L'automatisation n'a pas été activée." },
      { status: 503 }
    );
  }

  const template = getTemplateById(opportunity.templateId);
  let automation = await prisma.automation.findFirst({
    where: { companyId: company.id, opportunityId: opportunity.id },
    orderBy: { createdAt: "desc" },
  });

  if (!automation) {
    automation = await prisma.automation.create({
      data: {
        companyId: company.id,
        opportunityId: opportunity.id,
        templateId: opportunity.templateId,
        name: opportunity.title,
        businessGoal: template?.businessGoal ?? opportunity.description,
        status: "installing",
        health: "orange",
        toolsUsed: JSON.stringify(template?.relevantTools.slice(0, 3) ?? []),
        estimatedHoursPerMonth: opportunity.estimatedHoursPerMonth,
        estimatedValueEur: opportunity.estimatedValueEur,
      },
    });
  } else {
    automation = await prisma.automation.update({
      where: { id: automation.id },
      data: { status: "installing", health: "orange" },
    });
  }

  try {
    let workflowId = automation.n8nWorkflowId;
    if (!workflowId) {
      const workflow = await createWorkflow(buildContactListWorkflow(company.id, opportunity.templateId));
      workflowId = workflow.id;
      await prisma.automation.update({ where: { id: automation.id }, data: { n8nWorkflowId: workflowId } });
    }

    await activateWorkflow(workflowId);

    await prisma.$transaction([
      prisma.automation.update({
        where: { id: automation.id },
        data: { status: "active", health: "green", errorCount: 0, lastModifiedAt: new Date() },
      }),
      prisma.opportunity.update({ where: { id: opportunity.id }, data: { status: "installed" } }),
      prisma.company.update({
        where: { id: company.id },
        data: { automationScore: Math.min(95, company.automationScore + 5) },
      }),
    ]);

    await track(EVENTS.AUTOMATION_INSTALLED, {
      companyId: company.id,
      metadata: { automationId: automation.id, templateId: opportunity.templateId, plan: entitlements.plan },
    });

    return NextResponse.json({ automationId: automation.id });
  } catch (error) {
    console.error("n8n workflow installation failed:", error);
    await prisma.automation.update({
      where: { id: automation.id },
      data: { status: "warning", health: "red", errorCount: { increment: 1 }, lastModifiedAt: new Date() },
    });
    return NextResponse.json(
      { error: "L'installation réelle a échoué. Aucune exécution n'a été lancée. Vous pouvez réessayer après correction de la connexion." },
      { status: 502 }
    );
  }
}
