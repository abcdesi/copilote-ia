import { prisma } from "@/lib/db/client";

const CONVERSATION_EVENT = "COPILOT_CONVERSATION_CREATED";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getOrCreateTodayConversation(companyId: string, userId: string) {
  const mapping = await prisma.event.findFirst({
    where: {
      companyId,
      userId,
      type: CONVERSATION_EVENT,
      createdAt: { gte: startOfToday() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (mapping?.metadata) {
    const existing = await prisma.conversation.findFirst({
      where: { id: mapping.metadata, companyId },
    });
    if (existing) return existing;
  }

  const conversation = await prisma.conversation.create({ data: { companyId } });
  await prisma.event.create({
    data: {
      companyId,
      userId,
      type: CONVERSATION_EVENT,
      // Pour cet événement technique, metadata contient volontairement uniquement
      // l'identifiant afin de pouvoir vérifier l'appartenance sans parsing fragile.
      metadata: conversation.id,
    },
  });
  return conversation;
}

export async function listArchivedConversations(companyId: string, userId: string) {
  const mappings = await prisma.event.findMany({
    where: {
      companyId,
      userId,
      type: CONVERSATION_EVENT,
      createdAt: { lt: startOfToday() },
    },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
    take: 365,
  });
  const ids = mappings.map((event) => event.metadata).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];

  const conversations = await prisma.conversation.findMany({
    where: { companyId, id: { in: ids } },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  });
  const byId = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  return ids
    .map((id) => byId.get(id))
    .filter((conversation): conversation is NonNullable<typeof conversation> => Boolean(conversation))
    .filter((conversation) => conversation._count.messages > 0);
}

export async function getConversationForCompany(conversationId: string, companyId: string, userId: string) {
  const mapping = await prisma.event.findFirst({
    where: { companyId, userId, type: CONVERSATION_EVENT, metadata: conversationId },
    select: { id: true },
  });
  if (!mapping) return null;

  return prisma.conversation.findFirst({
    where: { id: conversationId, companyId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}
