import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runDiagnostic } from "@/lib/ai";
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

  const result = await runDiagnostic(input, []);

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
    metadata: { diagnosticId: diagnostic.id, opportunityCount: result.opportunities.length },
  });

  return NextResponse.json({ diagnosticId: diagnostic.id, result });
}
