import { prisma } from "@/lib/db/client";
import { getCurrentCompany } from "@/lib/companies/current";
import { getOrCreateTodayConversation } from "@/lib/companies/conversations";
import { ChatView } from "@/components/dashboard/ChatView";

export default async function CopilotPage() {
  const company = await getCurrentCompany();
  const conversation = await getOrCreateTodayConversation(company.id);

  const history = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <ChatView
      companyName={company.name}
      initialMessages={history.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }))}
    />
  );
}
