import { prisma } from "@/lib/db/client";

export async function findAttributedContactEvent(input: {
  companyId: string;
  prospectEmail: string;
  templateId: string;
  observedAt: Date;
}) {
  const prospect = await prisma.prospect.findFirst({
    where: {
      companyId: input.companyId,
      templateId: input.templateId,
      email: { equals: input.prospectEmail.trim(), mode: "insensitive" },
      status: "active",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true },
  });
  if (!prospect) return null;

  const contactEvent = await prisma.automationContactEvent.findFirst({
    where: {
      prospectId: prospect.id,
      kind: "message_sent",
      status: "sent",
      createdAt: { lte: input.observedAt },
      automation: {
        companyId: input.companyId,
        templateId: input.templateId,
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      automationId: true,
      automationRunId: true,
      createdAt: true,
    },
  });
  if (!contactEvent) return null;

  return { prospect, contactEvent };
}
