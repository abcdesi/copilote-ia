import { getCurrentCompany } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { ChatView } from "@/components/dashboard/ChatView";

export default async function CopilotPage() {
  const company = await getCurrentCompany();

  const history = await prisma.chatMessage.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  return (
    <ChatView
      companyName={company.name}
      initialMessages={history.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }))}
    />
  );
}
