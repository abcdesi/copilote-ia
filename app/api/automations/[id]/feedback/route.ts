import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getCurrentCompanyAccess } from "@/lib/companies/access";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

const bodySchema = z.object({
  sentiment: z.enum(["great", "good", "meh", "bad"]),
  timeSavedPerWeek: z.number().min(0).max(80).optional(),
  valueObservedEur30d: z.number().min(0).max(1_000_000).optional(),
  outcomeNote: z.string().trim().max(600).optional(),
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

  const observedAt = new Date();
  const actor = {
    actorUserId: access.session.user.id,
    actorName: access.session.user.name ?? null,
    actorEmail: access.session.user.email ?? null,
    actorRole: access.role,
  };

  await prisma.$transaction(async (tx) => {
    const created = await tx.automationFeedback.create({
      data: {
        automationId: automation.id,
        sentiment: parsed.data.sentiment,
        timeSavedPerWeek: parsed.data.timeSavedPerWeek,
      },
    });

    const outcomes = [];
    if (typeof parsed.data.timeSavedPerWeek === "number") {
      outcomes.push(
        tx.automationOutcome.create({
          data: {
            automationId: automation.id,
            kind: "time_saved_weekly_hours",
            value: parsed.data.timeSavedPerWeek,
            unit: "hours_per_week",
            source: "user_reported",
            confidence: 0.75,
            note: parsed.data.outcomeNote || null,
            observedAt,
            ...actor,
          },
        })
      );
    }
    if (typeof parsed.data.valueObservedEur30d === "number") {
      outcomes.push(
        tx.automationOutcome.create({
          data: {
            automationId: automation.id,
            kind: "value_observed_eur_30d",
            value: parsed.data.valueObservedEur30d,
            unit: "eur_30d",
            source: "user_reported",
            confidence: 0.7,
            note: parsed.data.outcomeNote || null,
            observedAt,
            ...actor,
          },
        })
      );
    }
    if (outcomes.length > 0) await Promise.all(outcomes);

    await tx.event.create({
      data: {
        companyId: access.company.id,
        userId: access.session.user.id,
        type: "AUTOMATION_FEEDBACK_SUBMITTED",
        metadata: JSON.stringify({
          feedbackId: created.id,
          automationId: automation.id,
          sentiment: parsed.data.sentiment,
          actorRole: access.role,
          outcomeKinds: [
            typeof parsed.data.timeSavedPerWeek === "number" ? "time_saved_weekly_hours" : null,
            typeof parsed.data.valueObservedEur30d === "number" ? "value_observed_eur_30d" : null,
          ].filter(Boolean),
        }),
      },
    });
  });
  await track(EVENTS.FEEDBACK_SUBMITTED, {
    userId: access.session.user.id,
    companyId: access.company.id,
    metadata: {
      automationId: automation.id,
      sentiment: parsed.data.sentiment,
      actorRole: access.role,
      hasMeasuredOutcome:
        typeof parsed.data.timeSavedPerWeek === "number" || typeof parsed.data.valueObservedEur30d === "number",
    },
  });

  return NextResponse.json({ ok: true });
}
