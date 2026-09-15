import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getDiagnosticSessionToken } from "@/lib/session";
import { createDiagnosticShareToken } from "@/lib/diagnostics/share";
import { SITE_URL } from "@/lib/config";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

const schema = z.object({ diagnosticId: z.string().min(8).max(100) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Diagnostic invalide." }, { status: 400 });

  const sessionToken = await getDiagnosticSessionToken();
  if (!sessionToken) return NextResponse.json({ error: "Session de diagnostic introuvable." }, { status: 403 });

  const diagnostic = await prisma.diagnostic.findFirst({
    where: { id: parsed.data.diagnosticId, sessionToken },
    select: { id: true },
  });
  if (!diagnostic) return NextResponse.json({ error: "Diagnostic introuvable." }, { status: 404 });

  const token = createDiagnosticShareToken(diagnostic.id);
  await track(EVENTS.DIAGNOSTIC_SHARED, { metadata: { diagnosticId: diagnostic.id } }).catch(() => undefined);
  return NextResponse.json({ url: `${SITE_URL}/report/${token}` });
}
