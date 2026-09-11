import { prisma } from "@/lib/db/client";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Une conversation par jour : la première fois qu'on en a besoin aujourd'hui,
// on en crée une nouvelle et vide ; les suivantes dans la même journée la réutilisent.
export async function getOrCreateTodayConversation(companyId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { companyId, createdAt: { gte: startOfToday() } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.conversation.create({ data: { companyId } });
}

// Conversations passées (hors celle du jour), les plus récentes d'abord.
export async function listArchivedConversations(companyId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { companyId, createdAt: { lt: startOfToday() } },
    orderBy: { createdAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  });
  return conversations.filter((c) => c._count.messages > 0);
}

export async function getConversationForCompany(conversationId: string, companyId: string) {
  return prisma.conversation.findFirst({
    where: { id: conversationId, companyId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}
