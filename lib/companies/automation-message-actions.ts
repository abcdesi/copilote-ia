"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";

const schema = z.object({
  automationId: z.string().min(1),
  subject: z.string().max(200).optional(),
  body: z.string().max(4000).optional(),
});

export async function updateMessageTemplateAction(formData: FormData) {
  const session = await requireSession();
  const parsed = schema.safeParse({
    automationId: formData.get("automationId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;

  const subject = parsed.data.subject?.trim();
  const body = parsed.data.body?.trim();

  // Chaîne vide = retour aux valeurs par défaut du template (on stocke null).
  await prisma.automation.updateMany({
    where: { id: parsed.data.automationId, companyId: company.id },
    data: {
      messageSubject: subject ? subject : null,
      messageBody: body ? body : null,
    },
  });
  revalidatePath(`/app/automations/${parsed.data.automationId}`);
}
