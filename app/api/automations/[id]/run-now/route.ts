import { NextRequest, NextResponse } from "next/server";
import { canApproveRisk, requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { triggerAutomation } from "@/lib/n8n/execution";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCompanyPermission("operate_automations");
    const { id } = await params;
    const automation = await prisma.automation.findFirst({ where: { id, companyId: access.company.id } });
    if (!automation) return NextResponse.json({ error: "Automatisation introuvable." }, { status: 404 });
    if (!automation.n8nWorkflowId) {
      return NextResponse.json({ error: "Cette automatisation ne dispose pas encore d'un moteur d'exécution réel." }, { status: 400 });
    }
    if (!canApproveRisk(access.role, automation.riskLevel)) {
      return NextResponse.json(
        { error: "Votre rôle ne permet pas de lancer manuellement une automatisation de ce niveau de risque.", riskLevel: automation.riskLevel },
        { status: 403 }
      );
    }

    const outcome = await triggerAutomation(automation, "manual", {
      userId: access.session.user.id,
      role: access.role,
      name: access.session.user.name,
      email: access.session.user.email,
    });

    if (!outcome.ok) {
      if ("upgradeRequired" in outcome && outcome.upgradeRequired) {
        return NextResponse.json({ error: outcome.error, upgradeRequired: true, href: "/app/settings" }, { status: 403 });
      }
      if ("usageLimited" in outcome && outcome.usageLimited) {
        return NextResponse.json({ error: outcome.error, usageLimited: true, reason: outcome.reason, href: "/app/settings" }, { status: 429 });
      }
      if ("approvalRequired" in outcome && outcome.approvalRequired) {
        return NextResponse.json({ error: outcome.error, approvalRequired: true, href: `/app/automations/${automation.id}` }, { status: 409 });
      }
      if ("inactive" in outcome && outcome.inactive) {
        return NextResponse.json({ error: outcome.error }, { status: 409 });
      }
      console.error("run-now failed:", outcome.error);
      return NextResponse.json({ error: "L'exécution réelle a échoué. Aucun coût technique échoué n'a été conservé." }, { status: 502 });
    }

    return NextResponse.json({ ok: true, result: outcome.result, noWork: "noWork" in outcome ? outcome.noWork : false });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    }
    throw error;
  }
}
