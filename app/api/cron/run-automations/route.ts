import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { triggerAutomation } from "@/lib/n8n/execution";

// Déclenchement automatique quotidien de toutes les automatisations à exécution
// réelle (appelé par le cron Vercel défini dans vercel.json). Sans ça, une
// automatisation "réelle" ne se déclenchait que si quelqu'un cliquait manuellement
// sur "Lancer maintenant" — ce n'est pas ce que le client paie.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const automations = await prisma.automation.findMany({
    where: { n8nWorkflowId: { not: null }, status: { not: "inactive" } },
    select: { id: true, companyId: true, templateId: true, errorCount: true },
  });

  const results = [];
  for (const automation of automations) {
    const outcome = await triggerAutomation(automation);
    results.push({ automationId: automation.id, ok: outcome.ok });
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), count: results.length, results });
}
