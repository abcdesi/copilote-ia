// Déclenchement d'une automatisation à exécution réelle + mise à jour de sa santé à
// partir du résultat effectif — partagé entre le déclenchement manuel ("Lancer
// maintenant") et le déclenchement automatique planifié (cron).

import { prisma } from "@/lib/db/client";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { webhookPathForCompany } from "./workflows";

interface TriggerableAutomation {
  id: string;
  companyId: string;
  templateId: string | null;
  errorCount: number;
}

export async function triggerAutomation(automation: TriggerableAutomation) {
  const templateId = automation.templateId ?? "relance-prospects";
  const webhookUrl = `${process.env.N8N_API_URL}/webhook/${webhookPathForCompany(automation.companyId, templateId)}`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ companyId: automation.companyId, templateId }),
    });
    if (!res.ok) throw new Error(`n8n webhook error ${res.status}`);
    const result = await res.json();
    const sentCount: number = result?.relancedCount ?? 0;
    const runErrors: number = result?.errorCount ?? 0;

    await applyExecutionOutcome(automation.id, automation.errorCount, runErrors);

    // On ne journalise que ce qui s'est réellement passé — pas d'entrée pour une
    // exécution qui n'a trouvé aucun contact à traiter, pour ne pas noyer le flux
    // d'activité du client sous du bruit.
    if (sentCount > 0) {
      await track(EVENTS.AUTOMATION_EXECUTED, {
        companyId: automation.companyId,
        metadata: { templateId, sentCount },
      });
    }
    if (runErrors > 0) {
      await track(EVENTS.AUTOMATION_EXECUTION_ISSUE, {
        companyId: automation.companyId,
        metadata: { templateId, errorCount: runErrors },
      });
    }

    return { ok: true as const, result };
  } catch (err) {
    // Échec total de l'exécution (webhook injoignable, erreur n8n...) — compte comme
    // une erreur pleine, pas seulement partielle.
    await applyExecutionOutcome(automation.id, automation.errorCount, 1);
    await track(EVENTS.AUTOMATION_EXECUTION_ISSUE, {
      companyId: automation.companyId,
      metadata: { templateId, errorCount: 1 },
    });
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}

// Met à jour la santé de l'automatisation à partir du résultat réel de l'exécution :
// une exécution propre remet le compteur à zéro (auto-guérison), des échecs répétés
// font passer la santé en orange puis rouge et remontent l'automatisation dans les
// automatisations "à surveiller" (page Résultats).
export async function applyExecutionOutcome(automationId: string, previousErrorCount: number, newErrors: number) {
  const current = await prisma.automation.findUnique({ where: { id: automationId }, select: { status: true } });
  // Ne jamais réactiver automatiquement une automatisation que le client a désactivée
  // lui-même — seule une action explicite du client doit la remettre en marche.
  if (current?.status === "inactive") return;

  const errorCount = newErrors > 0 ? previousErrorCount + newErrors : 0;
  const health = errorCount === 0 ? "green" : errorCount <= 2 ? "orange" : "red";
  const status = errorCount >= 3 ? "warning" : "active";

  await prisma.automation.update({
    where: { id: automationId },
    data: { lastCheckedAt: new Date(), errorCount, health, status },
  });
}
