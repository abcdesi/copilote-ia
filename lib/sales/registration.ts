import "server-only";
import { prisma } from "@/lib/db/client";
import { getDiagnosticSessionToken } from "@/lib/session";

export async function recordSalesRegistration(userId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const sessionToken = await getDiagnosticSessionToken();
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
    if (sessionToken) {
      const diagnostic = await tx.diagnostic.findFirst({
        where: { sessionToken, companyId: null, claimedAt: null, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (diagnostic) {
        const dedupeKey = `diagnostic_completed:${diagnostic.id}`;
        await tx.salesLeadEvent.upsert({
          where: { dedupeKey },
          create: { leadId: lead.id, kind: "diagnostic_completed", dedupeKey },
          update: {},
        });
      }
    }
    await tx.salesLeadEvent.upsert({
      where: { dedupeKey: `account_created:${userId}` },
      create: { leadId: lead.id, kind: "account_created", dedupeKey: `account_created:${userId}` },
      update: {},
    });
  });
}
