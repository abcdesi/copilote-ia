import { prisma } from "@/lib/db/client";
import { getCurrentCompanyAccess } from "@/lib/companies/access";
import { getOrCreateTodayConversation } from "@/lib/companies/conversations";
import { ChatView } from "@/components/dashboard/ChatView";

export default async function CopilotPage() {
  const access = await getCurrentCompanyAccess();
  const company = access.company;
  const conversation = await getOrCreateTodayConversation(company.id, access.session.user.id);

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
