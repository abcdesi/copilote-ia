import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

const bodySchema = z.object({
  sentiment: z.enum(["great", "good", "meh", "bad"]),
  timeSavedPerWeek: z.number().min(0).max(80).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Réponse invalide." }, { status: 400 });

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return NextResponse.json({ error: "Aucune entreprise associée." }, { status: 404 });

  const automation = await prisma.automation.findFirst({ where: { id, companyId: company.id } });
  if (!automation) return NextResponse.json({ error: "Automatisation introuvable." }, { status: 404 });

  await prisma.automationFeedback.create({
    data: {
      automationId: automation.id,
      sentiment: parsed.data.sentiment,
      timeSavedPerWeek: parsed.data.timeSavedPerWeek,
    },
  });

  await track(EVENTS.FEEDBACK_SUBMITTED, {
    companyId: company.id,
    metadata: { automationId: automation.id, sentiment: parsed.data.sentiment },
  });

  return NextResponse.json({ ok: true });
}
