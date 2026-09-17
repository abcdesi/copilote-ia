import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getCurrentCompanyAccess } from "@/lib/companies/access";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

const bodySchema = z.object({
  sentiment: z.enum(["great", "good", "meh", "bad"]),
  timeSavedPerWeek: z.number().min(0).max(80).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCurrentCompanyAccess();
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Réponse invalide." }, { status: 400 });

  const automation = await prisma.automation.findFirst({ where: { id, companyId: access.company.id } });
  if (!automation) return NextResponse.json({ error: "Automatisation introuvable." }, { status: 404 });

  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.event.count({
    where: {
      companyId: access.company.id,
      userId: access.session.user.id,
      type: "AUTOMATION_FEEDBACK_SUBMITTED",
      createdAt: { gte: since },
    },
  });
  if (recent >= 20) return NextResponse.json({ error: "Trop de retours envoyés récemment." }, { status: 429 });

  const feedback = await prisma.automationFeedback.create({
    data: {
      automationId: automation.id,
      sentiment: parsed.data.sentiment,
      timeSavedPerWeek: parsed.data.timeSavedPerWeek,
    },
  });
  await prisma.event.create({
    data: {
      companyId: access.company.id,
      userId: access.session.user.id,
      type: "AUTOMATION_FEEDBACK_SUBMITTED",
      metadata: JSON.stringify({
        feedbackId: feedback.id,
        automationId: automation.id,
        sentiment: parsed.data.sentiment,
        actorRole: access.role,
      }),
    },
  });
  await track(EVENTS.FEEDBACK_SUBMITTED, {
    userId: access.session.user.id,
    companyId: access.company.id,
    metadata: { automationId: automation.id, sentiment: parsed.data.sentiment, actorRole: access.role },
  });

  return NextResponse.json({ ok: true });
}
