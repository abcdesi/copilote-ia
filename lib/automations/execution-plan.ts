import { prisma } from "@/lib/db/client";
import { getRealExecutionConfig } from "@/lib/n8n/real-execution-config";
import { renderMessageTemplate, validateMessageTemplate } from "@/lib/automations/governance";

export interface ExecutionPlanContact {
  id: string;
  name: string;
  email: string;
  contactCount: number;
  status: string;
  lastOutcome: string | null;
  lastContactedAt: Date | null;
  nextEligibleAt: Date | null;
  eligible: boolean;
  renderedSubject: string;
  renderedBody: string;
  missingVariables: string[];
}

export async function buildAutomationExecutionPlan(input: {
  automationId: string;
  companyId: string;
  now?: Date;
  includeIneligible?: boolean;
}) {
  const now = input.now ?? new Date();
  const automation = await prisma.automation.findFirst({
    where: { id: input.automationId, companyId: input.companyId },
  });
  if (!automation || !automation.templateId) return null;

  const config = getRealExecutionConfig(automation.templateId);
  if (!config) return null;

  const company = await prisma.company.findUnique({ where: { id: input.companyId } });
  if (!company) return null;

  const cadenceDays = automation.cadenceDays ?? config.defaultCadenceDays;
  const maxSendsPerContact = automation.maxSendsPerContact ?? config.defaultMaxSendsPerContact;
  const subject = automation.messageSubject || config.defaultSubject;
  const body = automation.messageBody || config.defaultBody;
  const templateValidation = validateMessageTemplate(subject, body);

  const prospects = await prisma.prospect.findMany({
    where: { companyId: input.companyId, templateId: automation.templateId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  const contacts: ExecutionPlanContact[] = prospects.map((prospect) => {
    const nextEligibleAt = prospect.lastContactedAt && cadenceDays != null
      ? new Date(prospect.lastContactedAt.getTime() + cadenceDays * 86400000)
      : null;
    const active = prospect.status === "active";
    const belowLimit = prospect.contactCount < maxSendsPerContact;
    const cadenceReached = prospect.lastContactedAt == null || (cadenceDays != null && Boolean(nextEligibleAt && nextEligibleAt <= now));
    const eligible = active && belowLimit && cadenceReached;
    const values = {
      name: prospect.name,
      email: prospect.email,
      company_name: company.name,
      siret: company.siret,
      address: company.address,
      phone: company.phone,
    } as const;
    const renderedSubject = renderMessageTemplate(subject, values);
    const renderedBody = renderMessageTemplate(body, values);
    return {
      id: prospect.id,
      name: prospect.name,
      email: prospect.email,
      contactCount: prospect.contactCount,
      status: prospect.status,
      lastOutcome: prospect.lastOutcome,
      lastContactedAt: prospect.lastContactedAt,
      nextEligibleAt,
      eligible,
      renderedSubject: renderedSubject.rendered,
      renderedBody: renderedBody.rendered,
      missingVariables: [...new Set([...renderedSubject.missing, ...renderedBody.missing, ...templateValidation.unknown])],
    };
  });

  const visibleContacts = input.includeIneligible ? contacts : contacts.filter((contact) => contact.eligible);
  return {
    automation,
    company,
    config,
    cadenceDays,
    maxSendsPerContact,
    subject,
    body,
    templateValidation,
    contacts: visibleContacts,
    eligibleContacts: contacts.filter((contact) => contact.eligible),
    blockedContacts: contacts.filter((contact) => !contact.eligible),
    unresolvedVariables: [...new Set(contacts.filter((contact) => contact.eligible).flatMap((contact) => contact.missingVariables))],
  };
}
