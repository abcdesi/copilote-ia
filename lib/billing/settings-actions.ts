"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireCompanyPermission } from "@/lib/companies/access";

const schema = z.object({
  monthlyCapEur: z.coerce.number().min(0).max(5000),
});

export async function updateAutomationPurchaseCapAction(formData: FormData) {
  const access = await requireCompanyPermission("manage_billing");
  const parsed = schema.safeParse({ monthlyCapEur: formData.get("monthlyCapEur") });
  if (!parsed.success) return;

  const previous = access.company.automationPurchaseMonthlyCapEur;
  if (previous === parsed.data.monthlyCapEur) return;

  await prisma.$transaction([
    prisma.company.update({
      where: { id: access.company.id },
      data: { automationPurchaseMonthlyCapEur: parsed.data.monthlyCapEur },
    }),
    prisma.event.create({
      data: {
        companyId: access.company.id,
        userId: access.session.user.id,
        type: "AUTOMATION_PURCHASE_CAP_UPDATED",
        metadata: JSON.stringify({
          previousCapEur: previous,
          nextCapEur: parsed.data.monthlyCapEur,
          actorRole: access.role,
        }),
      },
    }),
  ]);

  revalidatePath("/app/settings");
}
