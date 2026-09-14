import { NextRequest, NextResponse } from "next/server";
import { runMockDiagnostic } from "@/lib/ai/mock-engine";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getOrCreateDiagnosticSessionToken } from "@/lib/session";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

const bodySchema = z.object({
  input: z.string().min(3).max(2000),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Décrivez votre besoin en quelques mots." }, { status: 400 });
  }

  const { input } = parsed.data;
  const sessionToken = await getOrCreateDiagnosticSessionToken();

  await track(EVENTS.DIAGNOSTIC_STARTED, { metadata: { inputLength: input.length } });

  // Acquisition volontairement sans coût LLM : la preuve de valeur publique utilise
  // le moteur déterministe Pilotzia. Les appels IA payants commencent uniquement une
  // fois l'entreprise créée, où ils sont bornés par l'enveloppe d'essai.
  const result = runMockDiagnostic(input, []);

  const diagnostic = await prisma.diagnostic.create({
    data: {
      sessionToken,
      rawInput: input,
      detectedTools: JSON.stringify(result.detectedTools),
      automationScore: result.automationScore,
      resultJson: JSON.stringify(result),
    },
  });

  await track(EVENTS.DIAGNOSTIC_COMPLETED, {
    metadata: { diagnosticId: diagnostic.id, opportunityCount: result.opportunities.length, engine: "bounded_public" },
  });

  return NextResponse.json({ diagnosticId: diagnostic.id, result });
}
