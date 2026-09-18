import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { verifyN8nCallback } from "@/lib/n8n/callback-auth";
import { buildAutomationExecutionPlan } from "@/lib/automations/execution-plan";
import { automationConfigHash } from "@/lib/automations/governance";

const bodySchema = z.object({
  automationId: z.string().min(1),
  runId: z.string().min(1).nullable().optional(),
});

function automationFromEmail() {
  return process.env.PILOTZIA_AUTOMATION_FROM_EMAIL || process.env.PILOTZIA_SUPPORT_FROM_EMAIL || null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyN8nCallback(req)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête d'envoi invalide." }, { status: 400 });

  const { id: prospectId } = await params;
  const automation = await prisma.automation.findUnique({ where: { id: parsed.data.automationId } });
  if (!automation?.templateId || automation.status !== "active") {
    return NextResponse.json({ error: "Automatisation inactive ou introuvable." }, { status: 409 });
  }
  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, companyId: automation.companyId, templateId: automation.templateId, status: "active" },
  });
  if (!prospect) return NextResponse.json({ error: "Contact inactif ou introuvable." }, { status: 404 });

  let runId: string | null = null;
  if (parsed.data.runId) {
    const run = await prisma.automationRun.findFirst({ where: { id: parsed.data.runId, automationId: automation.id } });
    if (!run) return NextResponse.json({ error: "Exécution incohérente." }, { status: 409 });
    runId = run.id;
  }

  const plan = await buildAutomationExecutionPlan({ automationId: automation.id, companyId: automation.companyId });
  if (!plan) return NextResponse.json({ error: "Configuration d'automatisation invalide." }, { status: 409 });
  const planned = plan.eligibleContacts.find((contact) => contact.id === prospect.id);
  if (!planned) return NextResponse.json({ error: "Ce contact n'est pas éligible à une relance maintenant." }, { status: 409 });
  if (planned.missingVariables.length > 0) {
    return NextResponse.json({ error: "Variables de message non résolues.", missingVariables: planned.missingVariables }, { status: 409 });
  }

  const currentHash = automationConfigHash({
    templateId: automation.templateId,
    messageSubject: plan.subject,
    messageBody: plan.body,
    approvalMode: automation.approvalMode,
    cadenceDays: plan.cadenceDays,
    maxSendsPerContact: plan.maxSendsPerContact,
    scheduleStartHour: automation.scheduleStartHour,
    scheduleEndHour: automation.scheduleEndHour,
    scheduleDays: automation.scheduleDays,
    replyToEmail: automation.replyToEmail,
  });
  if (!automation.approvedConfigHash || automation.approvedConfigHash !== currentHash) {
    return NextResponse.json({ error: "Configuration non validée.", approvalRequired: true }, { status: 409 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = automationFromEmail();
  if (!apiKey || !fromEmail) {
    return NextResponse.json({ error: "Fournisseur email non configuré." }, { status: 503 });
  }

  const nextContactNumber = prospect.contactCount + 1;
  const idempotencyKey = `automation/${automation.id}/prospect/${prospect.id}/v${automation.messageVersion}/n${nextContactNumber}`.slice(0, 256);
  const sendingMarker = `sending:${idempotencyKey}`;

  // Marqueur optimiste : les appels concurrents partagent ensuite la même clé Resend.
  await prisma.prospect.updateMany({
    where: { id: prospect.id, contactCount: prospect.contactCount, status: "active" },
    data: { lastOutcome: sendingMarker },
  });

  const company = plan.company;
  const body: Record<string, unknown> = {
    from: `${company.name.replace(/[<>\r\n]/g, "").slice(0, 80)} via Pilotzia <${fromEmail}>`,
    to: [prospect.email],
    subject: planned.renderedSubject,
    text: planned.renderedBody,
  };
  if (automation.replyToEmail) body.reply_to = automation.replyToEmail;

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    await prisma.prospect.updateMany({
      where: { id: prospect.id, lastOutcome: sendingMarker },
      data: { lastOutcome: "send_failed" },
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi email impossible." }, { status: 502 });
  }

  const providerBody = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
  if (!response.ok || !providerBody.id) {
    await prisma.prospect.updateMany({
      where: { id: prospect.id, lastOutcome: sendingMarker },
      data: { lastOutcome: "send_failed" },
    });
    return NextResponse.json(
      { error: "Le fournisseur email a refusé l'envoi.", providerStatus: response.status },
      { status: response.status === 429 ? 429 : 502 }
    );
  }

  const sentAt = new Date();
  const existingEvidence = await prisma.automationContactEvent.findFirst({
    where: {
      automationId: automation.id,
      prospectId: prospect.id,
      provider: "resend",
      providerMessageId: providerBody.id,
    },
  });

  if (!existingEvidence) {
    await prisma.$transaction(async (tx) => {
      const finalized = await tx.prospect.updateMany({
        where: { id: prospect.id, contactCount: prospect.contactCount, status: "active" },
        data: {
          lastContactedAt: sentAt,
          contactCount: { increment: 1 },
          lastOutcome: "sent",
        },
      });
      if (finalized.count === 1) {
        await tx.automationContactEvent.create({
          data: {
            automationId: automation.id,
            automationRunId: runId,
            prospectId: prospect.id,
            kind: "message_sent",
            status: "sent",
            recipientName: prospect.name,
            recipientEmail: prospect.email,
            renderedSubject: planned.renderedSubject,
            renderedBody: planned.renderedBody,
            provider: "resend",
            providerMessageId: providerBody.id,
            messageVersion: automation.messageVersion,
            evidenceJson: JSON.stringify({
              sentAt: sentAt.toISOString(),
              provider: "resend",
              providerMessageId: providerBody.id,
              idempotencyKey,
              contactNumber: nextContactNumber,
            }),
          },
        });
      }
    });
  }

  return NextResponse.json({
    ok: true,
    provider: "resend",
    providerMessageId: providerBody.id,
    idempotencyKey,
    messageVersion: automation.messageVersion,
  });
}
