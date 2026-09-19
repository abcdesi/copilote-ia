import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyN8nCallback } from "@/lib/n8n/callback-auth";
import { recordTrustedProviderOutcome } from "@/lib/automations/provider-outcomes";

const bodySchema = z
  .object({
    companyId: z.string().min(1),
    automationId: z.string().min(1),
    prospectId: z.string().min(1).optional(),
    provider: z.enum(["hubspot", "stripe"]),
    providerEventId: z.string().trim().min(1).max(240),
    kind: z.enum(["deal_won", "payment_received"]),
    observedAt: z.string().datetime({ offset: true }),
    amountEur: z.number().positive().max(100_000_000).optional(),
    externalEntityRef: z.string().trim().min(1).max(240).optional(),
    note: z.string().trim().max(600).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.provider === "hubspot" && value.kind !== "deal_won") {
      ctx.addIssue({ code: "custom", message: "HubSpot est accepté uniquement pour deal_won.", path: ["kind"] });
    }
    if (value.provider === "stripe" && value.kind !== "payment_received") {
      ctx.addIssue({ code: "custom", message: "Stripe est accepté uniquement pour payment_received.", path: ["kind"] });
    }
    if (value.kind === "deal_won" && !value.prospectId) {
      ctx.addIssue({ code: "custom", message: "prospectId est requis pour un deal gagné.", path: ["prospectId"] });
    }
    if (value.kind === "payment_received" && typeof value.amountEur !== "number") {
      ctx.addIssue({ code: "custom", message: "amountEur est requis pour un encaissement.", path: ["amountEur"] });
    }
  });

export async function POST(req: NextRequest) {
  if (!verifyN8nCallback(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Résultat fournisseur invalide.", details: parsed.error.flatten() }, { status: 400 });
  }

  const observedAt = new Date(parsed.data.observedAt);
  if (observedAt.getTime() > Date.now() + 5 * 60 * 1000) {
    return NextResponse.json({ error: "observedAt ne peut pas être dans le futur." }, { status: 400 });
  }

  const result = await recordTrustedProviderOutcome({
    companyId: parsed.data.companyId,
    automationId: parsed.data.automationId,
    prospectId: parsed.data.prospectId ?? null,
    provider: parsed.data.provider,
    providerEventId: parsed.data.providerEventId,
    kind: parsed.data.kind,
    observedAt,
    amountEur: parsed.data.amountEur ?? null,
    externalEntityRef: parsed.data.externalEntityRef ?? null,
    note: parsed.data.note ?? null,
  });

  if (!result.ok) {
    const status = result.reason === "automation_not_found" || result.reason === "prospect_not_found" ? 404 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
    outcomeId: result.outcomeId,
  });
}
