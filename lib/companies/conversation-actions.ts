"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getCurrentCompanyAccess } from "@/lib/companies/access";

export async function deleteConversationAction(formData: FormData) {
  const access = await getCurrentCompanyAccess();
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!conversationId) return;

  const mapping = await prisma.event.findFirst({
    where: {
      companyId: access.company.id,
      userId: access.session.user.id,
      type: "COPILOT_CONVERSATION_CREATED",
      metadata: conversationId,
    },
    select: { id: true },
  });
  if (!mapping) return;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, companyId: access.company.id },
    select: { id: true },
  });
  if (!conversation) return;

  await prisma.$transaction([
    prisma.conversation.delete({ where: { id: conversation.id } }),
    prisma.event.create({
      data: {
        companyId: access.company.id,
        userId: access.session.user.id,
        type: "COPILOT_CONVERSATION_DELETED",
        metadata: JSON.stringify({
          conversationId,
          actorName: access.session.user.name ?? null,
          actorEmail: access.session.user.email ?? null,
          actorRole: access.role,
        }),
      },
    }),
  ]);
  revalidatePath("/app/copilot/history");
}
