import { prisma } from "@/lib/db/client";
import type { OperationalEventKind } from "./types";

const EVENT_TYPES: Record<OperationalEventKind, string> = {
  demand_received: "DEMAND_RECEIVED",
  email_received: "EMAIL_RECEIVED",
  meeting_scheduled: "MEETING_SCHEDULED",
  quote_sent: "QUOTE_SENT",
  quote_accepted: "QUOTE_ACCEPTED",
  invoice_paid: "INVOICE_PAID",
  supplier_followup: "SUPPLIER_FOLLOWUP",
  planning_optimized: "PLANNING_OPTIMIZED",
  action_completed: "ACTION_COMPLETED",
};

export async function recordOperationalEvent(input: {
  companyId: string;
  kind: OperationalEventKind;
  source: string;
  externalRef?: string;
  count?: number;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const occurredAt = input.occurredAt ?? new Date();
  const type = EVENT_TYPES[input.kind];

  // Les webhooks et synchronisations peuvent être rejoués. Une référence externe
  // stable empêche de compter deux fois la même action métier sans imposer un
  // schéma propre à chaque fournisseur dans le cœur de Pilotzia.
  if (input.externalRef) {
    const duplicate = await prisma.event.findFirst({
      where: {
        companyId: input.companyId,
        type,
        metadata: { contains: `\"externalRef\":\"${input.externalRef.replaceAll("\"", "\\\"")}\"` },
      },
      select: { id: true },
    });
    if (duplicate) return duplicate;
  }

  return prisma.event.create({
    data: {
      companyId: input.companyId,
      type,
      createdAt: occurredAt,
      metadata: JSON.stringify({
        source: input.source,
        externalRef: input.externalRef ?? null,
        count: input.count ?? 1,
        ...(input.metadata ?? {}),
      }),
    },
  });
}
