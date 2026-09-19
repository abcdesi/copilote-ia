import { prisma } from "@/lib/db/client";
import { getDashboardShellAccess } from "@/lib/companies/access";
import { safeRead } from "@/lib/runtime/safe-read";
import { getOrCreateTodayConversation } from "@/lib/companies/conversations";
import { ChatView } from "@/components/dashboard/ChatView";
import type { ChatViewMessage } from "@/components/dashboard/ChatView";

export default async function CopilotPage() {
  const access = await getDashboardShellAccess();
  const company = access.company;
  const conversation = await safeRead(
    "copilot.today-conversation",
    () => getOrCreateTodayConversation(company.id, access.session.user.id),
    null
  );

  const history = conversation
    ? await safeRead(
        "copilot.history",
        () =>
          prisma.chatMessage.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "asc" },
            select: { id: true, role: true, content: true, actionsJson: true },
          }),
        []
      )
    : [];

  return (
    <ChatView
      companyName={company.name}
      initialMessages={history.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        actions: parseActions(m.actionsJson),
      }))}
    />
  );
}


function parseActions(value: string | null): ChatViewMessage["actions"] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
