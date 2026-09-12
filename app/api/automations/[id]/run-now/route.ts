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

    // Nombre de contacts pour qui l'envoi a échoué dans cette exécution (envoi
    // partiellement réussi) — remonté par le workflow n8n lui-même.
    const runErrors: number = result?.errorCount ?? 0;
    await applyExecutionOutcome(automation.id, automation.errorCount, runErrors);

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("run-now failed:", err);
    // Échec total de l'exécution (webhook injoignable, erreur n8n...) — compte comme
    // une erreur pleine, pas seulement partielle.
    await applyExecutionOutcome(automation.id, automation.errorCount, 1);
    return NextResponse.json({ error: "L'exécution a échoué." }, { status: 502 });
  }
}

// Met à jour la santé de l'automatisation à partir du résultat réel de l'exécution :
// une exécution propre remet le compteur à zéro (auto-guérison), des échecs répétés
// font passer la santé en orange puis rouge et remontent l'automatisation dans les
// automatisations "à surveiller" (page Résultats).
async function applyExecutionOutcome(automationId: string, previousErrorCount: number, newErrors: number) {
  const errorCount = newErrors > 0 ? previousErrorCount + newErrors : 0;
  const health = errorCount === 0 ? "green" : errorCount <= 2 ? "orange" : "red";
  const status = errorCount >= 3 ? "warning" : "active";

  await prisma.automation.update({
    where: { id: automationId },
    data: { lastCheckedAt: new Date(), errorCount, health, status },
  });
}
