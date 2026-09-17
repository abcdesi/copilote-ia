import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyN8nCallback } from "@/lib/n8n/callback-auth";
import { buildAutomationExecutionPlan } from "@/lib/automations/execution-plan";
import { automationConfigHash } from "@/lib/automations/governance";

export async function GET(req: NextRequest) {
  if (!verifyN8nCallback(req)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const companyId = req.nextUrl.searchParams.get("companyId");
  const automationId = req.nextUrl.searchParams.get("automationId");
  const templateId = req.nextUrl.searchParams.get("templateId") || "relance-prospects";
  if (!companyId) return NextResponse.json({ error: "companyId requis." }, { status: 400 });

  const automation = automationId
    ? await prisma.automation.findFirst({ where: { id: automationId, companyId } })
    : await prisma.automation.findFirst({ where: { companyId, templateId }, orderBy: { createdAt: "desc" } });
  if (!automation) return NextResponse.json({ error: "Automatisation introuvable." }, { status: 404 });
  if (automation.status !== "active") {
    return NextResponse.json({ error: "Cette automatisation n'est pas active." }, { status: 409 });
  }

  const plan = await buildAutomationExecutionPlan({ automationId: automation.id, companyId });
  if (!plan) return NextResponse.json({ error: "Configuration d'automatisation invalide." }, { status: 409 });

  const currentHash = automationConfigHash({
    templateId: automation.templateId,
    messageSubject: plan.subject,
    messageBody: plan.body,
    approvalMode: automation.approvalMode,
    cadenceDays: plan.cadenceDays,
    maxSendsPerContact: plan.maxSendsPerContact,
    replyToEmail: automation.replyToEmail,
  });
  if (!automation.approvedConfigHash || automation.approvedConfigHash !== currentHash) {
    return NextResponse.json({ error: "La configuration doit être validée avant exécution.", approvalRequired: true }, { status: 409 });
  }
  if (plan.unresolvedVariables.length > 0) {
    return NextResponse.json(
      { error: "Des variables du message ne peuvent pas être résolues.", unresolvedVariables: plan.unresolvedVariables },
      { status: 409 }
    );
  }

  return NextResponse.json({
    automationId: automation.id,
    messageVersion: automation.messageVersion,
    approvalMode: automation.approvalMode,
    cadenceDays: plan.cadenceDays,
    maxSendsPerContact: plan.maxSendsPerContact,
    prospects: plan.eligibleContacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      contactCount: contact.contactCount,
      renderedSubject: contact.renderedSubject,
      renderedBody: contact.renderedBody,
      messageVersion: automation.messageVersion,
    })),
  });
}
