"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireCompanyPermission } from "@/lib/companies/access";
import { validateMessageTemplate } from "@/lib/automations/governance";

const schema = z.object({
  automationId: z.string().min(1),
  subject: z.string().max(200).optional(),
  body: z.string().max(4000).optional(),
});

export async function updateMessageTemplateAction(formData: FormData) {
  const access = await requireCompanyPermission("configure_automations");
  const parsed = schema.safeParse({
    automationId: formData.get("automationId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;

  const automation = await prisma.automation.findFirst({ where: { id: parsed.data.automationId, companyId: access.company.id } });
  if (!automation) return;

  const subject = parsed.data.subject?.trim() ?? "";
  const body = parsed.data.body?.trim() ?? "";
  const validation = validateMessageTemplate(subject, body);
  if (!validation.valid) throw new Error(`AUTOMATION_UNKNOWN_VARIABLES:${validation.unknown.join(",")}`);

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
        lastApprovedAt: null,
        lastApprovedBy: null,
        lastModifiedAt: new Date(),
        status: automation.status === "inactive" ? "inactive" : "needs_review",
      },
    }),
    prisma.automationAuditEvent.create({
      data: {
        automationId: automation.id,
        actorUserId: access.session.user.id,
        actorName: access.session.user.name ?? null,
        actorEmail: access.session.user.email ?? null,
        actorRole: access.role,
        eventType: "message_changed",
        detailsJson: JSON.stringify({
          previousVersion: automation.messageVersion,
          nextVersion: automation.messageVersion + 1,
          variables: validation.variables,
          approvalInvalidated: true,
        }),
      },
    }),
  ]);
  revalidatePath(`/app/automations/${automation.id}`);
}
