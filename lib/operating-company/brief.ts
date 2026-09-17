import { prisma } from "@/lib/db/client";
import type { OperatingBrief, OperationalMetric } from "./types";

const EVENT_METRICS: Record<string, { key: string; label: string }> = {
  DEMAND_RECEIVED: { key: "demand_received", label: "Demandes reçues" },
  QUOTE_SENT: { key: "quote_sent", label: "Devis envoyés" },
  QUOTE_ACCEPTED: { key: "quote_accepted", label: "Devis acceptés" },
  INVOICE_PAID: { key: "invoice_paid", label: "Factures payées" },
  SUPPLIER_FOLLOWUP: { key: "supplier_followup", label: "Fournisseurs relancés" },
  PLANNING_OPTIMIZED: { key: "planning_optimized", label: "Optimisations planning" },
};

function parseMetadata(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {} as Record<string, unknown>;
  }
}

/**
 * Produit un résumé uniquement à partir d'événements et actions persistés.
 * Aucun chiffre n'est inféré par le LLM : chaque métrique reste rattachée à sa source.
 */
export async function getOperatingBrief(companyId: string, hours = 24): Promise<OperatingBrief> {
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

  const [events, decisions, completedActions] = await Promise.all([
    prisma.event.findMany({
      where: { companyId, createdAt: { gte: from, lte: to }, type: { in: Object.keys(EVENT_METRICS) } },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
    prisma.pendingAction.findMany({
      where: { companyId, status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.pendingAction.count({
      where: { companyId, status: { in: ["executed", "completed"] }, executedAt: { gte: from, lte: to } },
    }),
  ]);

  const metricMap = new Map<string, OperationalMetric>();
  for (const event of events) {
    const definition = EVENT_METRICS[event.type];
    if (!definition) continue;
    const metadata = parseMetadata(event.metadata);
    const source = typeof metadata.source === "string" ? metadata.source : "pilotzia";
    const amount = typeof metadata.count === "number" && Number.isFinite(metadata.count) ? Math.max(0, metadata.count) : 1;
    const mapKey = `${definition.key}:${source}`;
    const existing = metricMap.get(mapKey);
    if (existing) existing.count += amount;
    else metricMap.set(mapKey, { ...definition, count: amount, source });
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    metrics: [...metricMap.values()],
    decisions: decisions.map((action) => ({
      id: action.id,
      title: action.title,
      description: action.description,
      riskLevel: action.riskLevel,
      createdAt: action.createdAt.toISOString(),
    })),
    completedActions,
    evidenceCount: events.length,
  };
}
