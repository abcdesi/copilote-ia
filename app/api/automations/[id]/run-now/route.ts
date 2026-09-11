import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { webhookPathForCompany } from "@/lib/n8n/workflows";

// Déclenche immédiatement une automatisation réellement exécutée (n8n), pour tester
// ou forcer un passage sans attendre le prochain déclenchement programmé.
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

  const templateId = automation.templateId ?? "relance-prospects";
  const webhookUrl = `${process.env.N8N_API_URL}/webhook/${webhookPathForCompany(company.id, templateId)}`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companyId: company.id, templateId }),
    });
    if (!res.ok) throw new Error(`n8n webhook error ${res.status}`);
    const result = await res.json();

    await prisma.automation.update({ where: { id: automation.id }, data: { lastCheckedAt: new Date() } });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("run-now failed:", err);
    return NextResponse.json({ error: "L'exécution a échoué." }, { status: 502 });
  }
}
