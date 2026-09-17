import { prisma } from "@/lib/db/client";
import type { OperationalEventKind } from "./types";

const EVENT_TYPES: Record<OperationalEventKind, string> = {
  demand_received: "DEMAND_RECEIVED",
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
  return prisma.event.create({
    data: {
      companyId: input.companyId,
      type: EVENT_TYPES[input.kind],
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
