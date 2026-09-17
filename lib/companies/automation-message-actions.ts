"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { validateMessageTemplate } from "@/lib/automations/governance";

const schema = z.object({
  automationId: z.string().min(1),
  subject: z.string().max(200).optional(),
  body: z.string().max(4000).optional(),
});

export async function updateMessageTemplateAction(formData: FormData) {
  const session = await requireSession();
  const parsed = schema.safeParse({
    automationId: formData.get("automationId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;

  const automation = await prisma.automation.findFirst({ where: { id: parsed.data.automationId, companyId: company.id } });
  if (!automation) return;

  const subject = parsed.data.subject?.trim() ?? "";
  const body = parsed.data.body?.trim() ?? "";
  const validation = validateMessageTemplate(subject, body);
  if (!validation.valid) return;

  const changed = (automation.messageSubject ?? "") !== subject || (automation.messageBody ?? "") !== body;
  if (!changed) return;

  await prisma.$transaction([
    prisma.automation.update({
      where: { id: automation.id },
      data: {
        messageSubject: subject || null,
        messageBody: body || null,
        messageVersion: { increment: 1 },
        approvedConfigHash: null,
        lastModifiedAt: new Date(),
      },
    }),
    prisma.automationAuditEvent.create({
      data: {
        automationId: automation.id,
        actorUserId: session.user.id,
        eventType: "message_changed",
        detailsJson: JSON.stringify({ variables: validation.variables, approvalInvalidated: true }),
      },
    }),
  ]);
  revalidatePath(`/app/automations/${automation.id}`);
}
