"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";

export async function deleteConversationAction(formData: FormData) {
  const session = await requireSession();
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!conversationId) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;

  await prisma.conversation.deleteMany({ where: { id: conversationId, companyId: company.id } });
  revalidatePath("/app/copilot/history");
}
