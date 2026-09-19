import { prisma } from "@/lib/db/client";

export async function recordFirstDigitalProductUse(input: {
  companyId: string;
  opportunityId: string | null;
  automationId: string;
  runId: string;
  source: string;
  sentCount: number;
}) {
  if (!input.opportunityId || input.sentCount <= 0) return false;

  const usedAt = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.purchase.updateMany({
      where: {
        companyId: input.companyId,
        opportunityId: input.opportunityId!,
        status: "paid",
        firstUsedAt: null,
      },
      data: { firstUsedAt: usedAt },
    });

    if (updated.count === 0) return false;

    await tx.event.create({
      data: {
        companyId: input.companyId,
        type: "AUTOMATION_DIGITAL_PRODUCT_FIRST_USED",
        metadata: JSON.stringify({
          opportunityId: input.opportunityId,
          automationId: input.automationId,
          runId: input.runId,
          source: input.source,
          sentCount: input.sentCount,
          firstUsedAt: usedAt.toISOString(),
        }),
      },
    });
    return true;
  });
}
