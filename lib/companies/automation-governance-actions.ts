"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { getRealExecutionConfig } from "@/lib/n8n/real-execution-config";

const settingsSchema = z.object({
  automationId: z.string().min(1),
  approvalMode: z.enum(["always_review", "first_then_auto"]),
  cadenceDays: z.preprocess((value) => value === "" || value == null ? null : value, z.coerce.number().int().min(1).max(180).nullable()),
  maxSendsPerContact: z.coerce.number().int().min(1).max(20),
  replyToEmail: z.preprocess((value) => String(value ?? "").trim() || null, z.string().email().nullable()),
});

export async function updateAutomationGovernanceAction(formData: FormData) {
  const session = await requireSession();
  const parsed = settingsSchema.safeParse({
    automationId: formData.get("automationId"),
    approvalMode: formData.get("approvalMode"),
    cadenceDays: formData.get("cadenceDays"),
    maxSendsPerContact: formData.get("maxSendsPerContact"),
    replyToEmail: formData.get("replyToEmail"),
  });
  if (!parsed.success) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;
  const automation = await prisma.automation.findFirst({ where: { id: parsed.data.automationId, companyId: company.id } });
  if (!automation?.templateId) return;
  const config = getRealExecutionConfig(automation.templateId);
  if (!config || !config.allowedApprovalModes.includes(parsed.data.approvalMode)) return;

  const cadenceDays = config.defaultCadenceDays === null ? null : parsed.data.cadenceDays ?? config.defaultCadenceDays;
  const changed =
    automation.approvalMode !== parsed.data.approvalMode ||
    automation.cadenceDays !== cadenceDays ||
    automation.maxSendsPerContact !== parsed.data.maxSendsPerContact ||
    (automation.replyToEmail ?? null) !== parsed.data.replyToEmail;
  if (!changed) return;

  await prisma.$transaction([
    prisma.automation.update({
      where: { id: automation.id },
      data: {
        approvalMode: parsed.data.approvalMode,
        cadenceDays,
        maxSendsPerContact: parsed.data.maxSendsPerContact,
        replyToEmail: parsed.data.replyToEmail,
        configuredAt: new Date(),
        approvedConfigHash: null,
        lastModifiedAt: new Date(),
        status: automation.status === "inactive" ? "inactive" : "needs_review",
      },
    }),
    prisma.automationAuditEvent.create({
      data: {
        automationId: automation.id,
        actorUserId: session.user.id,
        eventType: "governance_changed",
        detailsJson: JSON.stringify({
          approvalMode: parsed.data.approvalMode,
          cadenceDays,
          maxSendsPerContact: parsed.data.maxSendsPerContact,
          replyToEmail: parsed.data.replyToEmail,
          approvalInvalidated: true,
        }),
      },
    }),
  ]);
  revalidatePath(`/app/automations/${automation.id}`);
}

export async function setProspectStatusAction(formData: FormData) {
  const session = await requireSession();
  const prospectId = String(formData.get("prospectId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!prospectId || !["active", "excluded"].includes(status)) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;
  const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, companyId: company.id } });
  if (!prospect) return;
  const automation = await prisma.automation.findFirst({ where: { companyId: company.id, templateId: prospect.templateId }, orderBy: { createdAt: "desc" } });

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: { status, archivedAt: status === "excluded" ? new Date() : null },
  });
  if (automation) {
    await prisma.automationAuditEvent.create({
      data: {
        automationId: automation.id,
        actorUserId: session.user.id,
        eventType: status === "excluded" ? "contact_excluded" : "contact_reactivated",
        detailsJson: JSON.stringify({ prospectId: prospect.id, email: prospect.email }),
      },
    });
    revalidatePath(`/app/automations/${automation.id}`);
  }
}
