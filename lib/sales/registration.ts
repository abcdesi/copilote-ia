import "server-only";
import { prisma } from "@/lib/db/client";

export async function recordSalesRegistration(userId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  await prisma.$transaction(async (tx) => {
    const lead = await tx.salesLead.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, stage: "registered" },
      update: {},
      select: { id: true },
    });
    // Conditional update prevents regressions from trial or paying stages.
    await tx.salesLead.updateMany({
      where: { id: lead.id, stage: { in: ["identified", "qualified", "diagnosed", "offer_recommended"] } },
      data: { stage: "registered" },
    });
    await tx.salesLeadEvent.upsert({
      where: { dedupeKey: `account_created:${userId}` },
      create: { leadId: lead.id, kind: "account_created", dedupeKey: `account_created:${userId}` },
      update: {},
    });
  });
}
