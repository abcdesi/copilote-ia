import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireCompanyPermission } from "@/lib/companies/access";
import { getTemplateById } from "@/lib/automations/catalog";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { isN8nConfigured, createWorkflow, activateWorkflow, updateWorkflow } from "@/lib/n8n/client";
import { buildContactListWorkflow } from "@/lib/n8n/workflows";
import { getRealExecutionConfig, isRealExecutionTemplate } from "@/lib/n8n/real-execution-config";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCompanyPermission("configure_automations");
    const { id } = await params;
    const company = access.company;

    const entitlements = await getCompanyEntitlements(company.id);
    if (!entitlements.canExecute) {
      return NextResponse.json(
        {
          error: "Une offre Action ou Scale active est requise pour exécuter une automatisation achetée.",
          upgradeRequired: true,
          href: "/app/settings",
        },
        { status: 403 }
      );
    }

    const opportunity = await prisma.opportunity.findFirst({ where: { id, companyId: company.id } });
    if (!opportunity) return NextResponse.json({ error: "Opportunité introuvable." }, { status: 404 });
    if (opportunity.status === "installed") {
      const installed = await prisma.automation.findFirst({
        where: { companyId: company.id, opportunityId: opportunity.id },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(
        { error: "Cette automatisation est déjà installée.", automationId: installed?.id ?? null },
        { status: 409 }
      );
    }

    const purchase = await prisma.purchase.findUnique({
      where: { companyId_opportunityId: { companyId: company.id, opportunityId: opportunity.id } },
      select: { id: true, status: true, amountEur: true, paymentUrl: true },
    });
    if (!purchase || purchase.status !== "paid") {
      return NextResponse.json(
        {
          error: "Cette automatisation doit être achetée avant installation.",
          purchaseRequired: true,
          amountEur: opportunity.priceEur,
          paymentUrl: purchase?.paymentUrl ?? null,
        },
        { status: 402 }
      );
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
    const executionConfig = getRealExecutionConfig(opportunity.templateId)!;
    let automation = await prisma.automation.findFirst({
      where: { companyId: company.id, opportunityId: opportunity.id },
      orderBy: { createdAt: "desc" },
    });

    const governanceDefaults = {
      messageSubject: executionConfig.defaultSubject,
      messageBody: executionConfig.defaultBody,
      messageVersion: 1,
      approvalMode: executionConfig.recommendedApprovalMode,
      riskLevel: executionConfig.riskLevel,
      cadenceDays: executionConfig.defaultCadenceDays,
      maxSendsPerContact: executionConfig.defaultMaxSendsPerContact,
      approvedConfigHash: null,
      lastApprovedAt: null,
      lastApprovedBy: null,
      configuredAt: new Date(),
    } as const;

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
          ...governanceDefaults,
        },
      });
    } else {
      automation = await prisma.automation.update({
        where: { id: automation.id },
        data: { status: "installing", health: "orange", ...governanceDefaults },
      });
    }

    try {
      const definition = buildContactListWorkflow(company.id, opportunity.templateId);
      let workflowId = automation.n8nWorkflowId;
      if (!workflowId) {
        const workflow = await createWorkflow(definition);
        workflowId = workflow.id;
        await prisma.automation.update({ where: { id: automation.id }, data: { n8nWorkflowId: workflowId } });
      } else {
        await updateWorkflow(workflowId, definition);
      }
      await activateWorkflow(workflowId);

      const deliveredAt = new Date();
      await prisma.$transaction([
        prisma.automation.update({
          where: { id: automation.id },
          data: {
            status: "needs_review",
            health: "orange",
            errorCount: 0,
            approvedConfigHash: null,
            lastModifiedAt: new Date(),
          },
        }),
        prisma.opportunity.update({ where: { id: opportunity.id }, data: { status: "installed" } }),
        prisma.purchase.update({
          where: { id: purchase.id },
          data: { deliveredAt },
        }),
        prisma.event.create({
          data: {
            companyId: company.id,
            userId: access.session.user.id,
            type: "AUTOMATION_DIGITAL_PRODUCT_DELIVERED",
            metadata: JSON.stringify({
              purchaseId: purchase.id,
              opportunityId: opportunity.id,
              automationId: automation.id,
              templateId: opportunity.templateId,
              deliveredAt: deliveredAt.toISOString(),
              actorRole: access.role,
              actorEmail: access.session.user.email ?? null,
            }),
          },
        }),
        prisma.company.update({
          where: { id: company.id },
          data: { automationScore: Math.min(95, company.automationScore + 5) },
        }),
        prisma.automationAuditEvent.create({
          data: {
            automationId: automation.id,
            actorUserId: access.session.user.id,
            actorName: access.session.user.name ?? null,
            actorEmail: access.session.user.email ?? null,
            actorRole: access.role,
            eventType: "automation_installed",
            detailsJson: JSON.stringify({
              templateId: opportunity.templateId,
              riskLevel: executionConfig.riskLevel,
              approvalMode: executionConfig.recommendedApprovalMode,
              status: "needs_review",
            }),
          },
        }),
      ]);

      await track(EVENTS.AUTOMATION_INSTALLED, {
        companyId: company.id,
        metadata: {
          automationId: automation.id,
          templateId: opportunity.templateId,
          plan: entitlements.plan,
          actorUserId: access.session.user.id,
          actorRole: access.role,
          requiresInitialApproval: true,
          purchaseId: purchase.id,
          purchaseAmountEur: purchase.amountEur,
        },
      });

      return NextResponse.json({ automationId: automation.id, status: "needs_review", approvalRequired: true });
    } catch (error) {
      console.error("n8n workflow installation failed:", error);
      await Promise.all([
        prisma.automation.update({
          where: { id: automation.id },
          data: { status: "warning", health: "red", errorCount: { increment: 1 }, lastModifiedAt: new Date() },
        }),
        prisma.automationAuditEvent.create({
          data: {
            automationId: automation.id,
            actorUserId: access.session.user.id,
            actorName: access.session.user.name ?? null,
            actorEmail: access.session.user.email ?? null,
            actorRole: access.role,
            eventType: "installation_failed",
            detailsJson: JSON.stringify({ error: error instanceof Error ? error.message.slice(0, 300) : "unknown" }),
          },
        }),
      ]);
      return NextResponse.json(
        { error: "L'installation réelle a échoué. Aucune exécution n'a été lancée. Vous pouvez réessayer après correction de la connexion." },
        { status: 502 }
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    }
    throw error;
  }
}
