"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { canApproveRisk, requireCompanyPermission } from "@/lib/companies/access";
import { getRealExecutionConfig } from "@/lib/n8n/real-execution-config";
import { buildAutomationExecutionPlan } from "@/lib/automations/execution-plan";
import { automationConfigHash, renderMessageTemplate, validateMessageTemplate } from "@/lib/automations/governance";

const settingsSchema = z.object({
  automationId: z.string().min(1),
  approvalMode: z.enum(["always_review", "first_then_auto"]),
  cadenceDays: z.preprocess(
    (value) => value === "" || value == null ? null : value,
    z.coerce.number().int().min(1).max(180).nullable()
  ),
  maxSendsPerContact: z.coerce.number().int().min(1).max(20),
  scheduleStartHour: z.coerce.number().int().min(0).max(23),
  scheduleEndHour: z.coerce.number().int().min(1).max(24),
  scheduleDays: z.array(z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])).min(1).max(7),
  replyToEmail: z.preprocess((value) => String(value ?? "").trim() || null, z.string().email().nullable()),
});

function actorSnapshot(access: Awaited<ReturnType<typeof requireCompanyPermission>>) {
  return {
    actorUserId: access.session.user.id,
    actorName: access.session.user.name ?? null,
    actorEmail: access.session.user.email ?? null,
    actorRole: access.role,
  };
}

export async function updateAutomationGovernanceAction(formData: FormData) {
  const access = await requireCompanyPermission("configure_automations");
  const parsed = settingsSchema.safeParse({
    automationId: formData.get("automationId"),
    approvalMode: formData.get("approvalMode"),
    cadenceDays: formData.get("cadenceDays"),
    maxSendsPerContact: formData.get("maxSendsPerContact"),
    scheduleStartHour: formData.get("scheduleStartHour"),
    scheduleEndHour: formData.get("scheduleEndHour"),
    scheduleDays: formData.getAll("scheduleDays").map(String),
    replyToEmail: formData.get("replyToEmail"),
  });
  if (!parsed.success) return;

  const automation = await prisma.automation.findFirst({ where: { id: parsed.data.automationId, companyId: access.company.id } });
  if (!automation?.templateId) return;
  const config = getRealExecutionConfig(automation.templateId);
  if (!config || !config.allowedApprovalModes.includes(parsed.data.approvalMode)) return;

  const cadenceDays = config.defaultCadenceDays === null ? null : parsed.data.cadenceDays ?? config.defaultCadenceDays;
  if (parsed.data.scheduleEndHour <= parsed.data.scheduleStartHour) return;
  const scheduleDays = parsed.data.scheduleDays.join(",");
  const changed =
    automation.approvalMode !== parsed.data.approvalMode ||
    automation.cadenceDays !== cadenceDays ||
    automation.maxSendsPerContact !== parsed.data.maxSendsPerContact ||
    automation.scheduleStartHour !== parsed.data.scheduleStartHour ||
    automation.scheduleEndHour !== parsed.data.scheduleEndHour ||
    automation.scheduleDays !== scheduleDays ||
    (automation.replyToEmail ?? null) !== parsed.data.replyToEmail;
  if (!changed) return;

  await prisma.$transaction([
    prisma.automation.update({
      where: { id: automation.id },
      data: {
        approvalMode: parsed.data.approvalMode,
        cadenceDays,
        maxSendsPerContact: parsed.data.maxSendsPerContact,
        scheduleStartHour: parsed.data.scheduleStartHour,
        scheduleEndHour: parsed.data.scheduleEndHour,
        scheduleDays,
        replyToEmail: parsed.data.replyToEmail,
        configuredAt: new Date(),
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
        ...actorSnapshot(access),
        eventType: "governance_changed",
        detailsJson: JSON.stringify({
          approvalMode: parsed.data.approvalMode,
          cadenceDays,
          maxSendsPerContact: parsed.data.maxSendsPerContact,
          scheduleStartHour: parsed.data.scheduleStartHour,
          scheduleEndHour: parsed.data.scheduleEndHour,
          scheduleDays,
          replyToEmail: parsed.data.replyToEmail,
          approvalInvalidated: true,
        }),
      },
    }),
  ]);
  revalidatePath(`/app/automations/${automation.id}`);
}

export async function approveAutomationConfigurationAction(formData: FormData) {
  const access = await requireCompanyPermission("configure_automations");
  const automationId = String(formData.get("automationId") ?? "");
  if (!automationId) return;

  const automation = await prisma.automation.findFirst({ where: { id: automationId, companyId: access.company.id } });
  if (!automation?.templateId) return;
  if (!canApproveRisk(access.role, automation.riskLevel)) throw new Error("AUTOMATION_RISK_PERMISSION_DENIED");

  const plan = await buildAutomationExecutionPlan({ automationId, companyId: access.company.id, includeIneligible: true });
  if (!plan) return;

  const validation = validateMessageTemplate(plan.subject, plan.body);
  if (!validation.valid) throw new Error("AUTOMATION_UNKNOWN_VARIABLES");

  // Les variables de contact sont remplies au moment de chaque envoi. Les variables
  // société doivent, elles, être disponibles dès la validation de la configuration.
  const previewValues = {
    name: "Contact exemple",
    email: "contact@example.com",
    company_name: access.company.name,
    siret: access.company.siret,
    address: access.company.address,
    phone: access.company.phone,
  } as const;
  const subjectPreview = renderMessageTemplate(plan.subject, previewValues);
  const bodyPreview = renderMessageTemplate(plan.body, previewValues);
  const missingCompanyVariables = [...new Set([...subjectPreview.missing, ...bodyPreview.missing])].filter(
    (key) => key !== "name" && key !== "email"
  );
  if (missingCompanyVariables.length > 0) {
    throw new Error(`AUTOMATION_MISSING_COMPANY_VARIABLES:${missingCompanyVariables.join(",")}`);
  }

  const configHash = automationConfigHash({
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
  const now = new Date();

  await prisma.$transaction([
    prisma.automation.update({
      where: { id: automation.id },
      data: {
        approvedConfigHash: configHash,
        lastApprovedAt: now,
        lastApprovedBy: access.session.user.id,
        status: automation.status === "inactive" ? "inactive" : "active",
        health: automation.status === "inactive" ? automation.health : "green",
        lastModifiedAt: now,
      },
    }),
    prisma.automationAuditEvent.create({
      data: {
        automationId: automation.id,
        ...actorSnapshot(access),
        eventType: "configuration_approved",
        detailsJson: JSON.stringify({
          configHash,
          approvalMode: automation.approvalMode,
          riskLevel: automation.riskLevel,
          cadenceDays: plan.cadenceDays,
          maxSendsPerContact: plan.maxSendsPerContact,
          scheduleStartHour: automation.scheduleStartHour,
          scheduleEndHour: automation.scheduleEndHour,
          scheduleDays: automation.scheduleDays,
          messageVersion: automation.messageVersion,
          eligibleContactsAtApproval: plan.eligibleContacts.length,
        }),
      },
    }),
  ]);

  revalidatePath(`/app/automations/${automation.id}`);
}

export async function setProspectStatusAction(formData: FormData) {
  const access = await requireCompanyPermission("manage_contacts");
  const prospectId = String(formData.get("prospectId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!prospectId || !["active", "excluded"].includes(status)) return;

  const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, companyId: access.company.id } });
  if (!prospect) return;
  const automation = await prisma.automation.findFirst({
    where: { companyId: access.company.id, templateId: prospect.templateId },
    orderBy: { createdAt: "desc" },
  });

  await prisma.prospect.update({
    where: { id: prospect.id },
    data: { status, archivedAt: status === "excluded" ? new Date() : null },
  });
  if (automation) {
    await prisma.automationAuditEvent.create({
      data: {
        automationId: automation.id,
        ...actorSnapshot(access),
        eventType: status === "excluded" ? "contact_excluded" : "contact_reactivated",
        detailsJson: JSON.stringify({ prospectId: prospect.id, email: prospect.email, previousStatus: prospect.status, nextStatus: status }),
      },
    });
    revalidatePath(`/app/automations/${automation.id}`);
  }
}
