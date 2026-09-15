import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { triggerAutomation } from "@/lib/n8n/execution";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return NextResponse.json({ error: "Aucune entreprise associée." }, { status: 404 });

  const automation = await prisma.automation.findFirst({ where: { id, companyId: company.id } });
  if (!automation) return NextResponse.json({ error: "Automatisation introuvable." }, { status: 404 });
  if (!automation.n8nWorkflowId) {
    return NextResponse.json({ error: "Cette automatisation est simulée, pas d'exécution réelle disponible." }, { status: 400 });
  }

  const outcome = await triggerAutomation(automation, "manual");
  if (!outcome.ok) {
    if ("upgradeRequired" in outcome && outcome.upgradeRequired) {
      return NextResponse.json(
        { error: outcome.error, upgradeRequired: true, href: "/app/settings" },
        { status: 403 }
      );
    }
    if ("usageLimited" in outcome && outcome.usageLimited) {
      return NextResponse.json(
        { error: outcome.error, usageLimited: true, reason: outcome.reason, href: "/app/settings" },
        { status: 429 }
      );
    }
    console.error("run-now failed:", outcome.error);
    return NextResponse.json({ error: "L'exécution réelle a échoué. Vérifiez la connexion puis réessayez." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, result: outcome.result });
}
