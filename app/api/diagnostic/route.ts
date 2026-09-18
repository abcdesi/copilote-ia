import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { runMockDiagnostic } from "@/lib/ai/mock-engine";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getOrCreateDiagnosticSessionToken } from "@/lib/session";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

const bodySchema = z.object({
  input: z.string().trim().min(3).max(2000),
});

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
}

function ipEventType(req: NextRequest) {
  const hash = createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 24);
  return `PUBLIC_DIAGNOSTIC_IP_${hash}`;
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Décrivez votre besoin en quelques mots." }, { status: 400 });
  }

  const { input } = parsed.data;
  const sessionToken = await getOrCreateDiagnosticSessionToken();
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const ipType = ipEventType(req);
  const [sessionCount, ipCount] = await Promise.all([
    prisma.diagnostic.count({ where: { sessionToken, createdAt: { gte: since } } }),
    prisma.event.count({ where: { type: ipType, createdAt: { gte: since } } }),
  ]);
  if (sessionCount >= 10 || ipCount >= 30) {
    return NextResponse.json(
      { error: "La limite de diagnostics gratuits a été atteinte pour le moment. Réessayez plus tard ou créez votre espace Pilotzia." },
      { status: 429 }
    );
  }

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
  await prisma.event.create({ data: { type: ipType, metadata: diagnostic.id } }).catch(() => undefined);

  await track(EVENTS.DIAGNOSTIC_COMPLETED, {
    metadata: { diagnosticId: diagnostic.id, opportunityCount: result.opportunities.length, engine: "bounded_public" },
  });

  return NextResponse.json({ diagnosticId: diagnostic.id, result });
}
