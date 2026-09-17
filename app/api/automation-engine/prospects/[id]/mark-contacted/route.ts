import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyN8nCallback } from "@/lib/n8n/callback-auth";

const bodySchema = z.object({
  automationId: z.string().min(1),
  runId: z.string().min(1).nullable().optional(),
  provider: z.string().min(1).max(40).default("resend"),
  providerMessageId: z.string().max(300).nullable().optional(),
  renderedSubject: z.string().max(500).nullable().optional(),
  renderedBody: z.string().max(20_000).nullable().optional(),
  messageVersion: z.coerce.number().int().min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyN8nCallback(req)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Preuve d'envoi invalide." }, { status: 400 });

  const automation = await prisma.automation.findUnique({ where: { id: parsed.data.automationId } });
  if (!automation?.templateId) return NextResponse.json({ error: "Automatisation introuvable." }, { status: 404 });
  const prospect = await prisma.prospect.findFirst({
    where: { id, companyId: automation.companyId, templateId: automation.templateId },
  });
  if (!prospect) return NextResponse.json({ error: "Contact introuvable pour cette automatisation." }, { status: 404 });

  let validRunId: string | null = null;
  if (parsed.data.runId) {
    const run = await prisma.automationRun.findFirst({ where: { id: parsed.data.runId, automationId: automation.id } });
    if (!run) return NextResponse.json({ error: "Exécution incohérente." }, { status: 409 });
    validRunId = run.id;
  }

  const contactedAt = new Date();
  await prisma.$transaction([
    prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        lastContactedAt: contactedAt,
        contactCount: { increment: 1 },
        lastOutcome: "sent",
      },
    }),
    prisma.automationContactEvent.create({
      data: {
        automationId: automation.id,
        automationRunId: validRunId,
        prospectId: prospect.id,
        kind: "message_sent",
        status: "sent",
        recipientName: prospect.name,
        recipientEmail: prospect.email,
        renderedSubject: parsed.data.renderedSubject ?? null,
        renderedBody: parsed.data.renderedBody ?? null,
        provider: parsed.data.provider,
        providerMessageId: parsed.data.providerMessageId ?? null,
        messageVersion: parsed.data.messageVersion,
        evidenceJson: JSON.stringify({
          sentAt: contactedAt.toISOString(),
          provider: parsed.data.provider,
          providerMessageId: parsed.data.providerMessageId ?? null,
          callbackAuthenticated: true,
        }),
      },
    }),
  ]);

  return NextResponse.json({ ok: true, contactCount: prospect.contactCount + 1 });
}
