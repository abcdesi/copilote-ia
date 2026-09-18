"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireCompanyPermission } from "@/lib/companies/access";
import { MARKETING_KPI_EVENT } from "@/lib/marketing/kpis";

const snapshotSchema = z.object({
  spendEur: z.coerce.number().finite().min(0).max(100_000_000),
  leads: z.coerce.number().int().min(0).max(100_000_000),
  conversions: z.coerce.number().int().min(0).max(100_000_000),
  customers: z.coerce.number().int().min(0).max(100_000_000),
  revenueEur: z.coerce.number().finite().min(0).max(1_000_000_000),
});

export async function saveMarketingKpiSnapshotAction(formData: FormData) {
  const access = await requireCompanyPermission("edit_company").catch((error) => {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") return null;
    throw error;
  });
  if (!access) return;

  const parsed = snapshotSchema.safeParse({
    spendEur: formData.get("spendEur"),
    leads: formData.get("leads"),
    conversions: formData.get("conversions"),
    customers: formData.get("customers"),
    revenueEur: formData.get("revenueEur"),
  });
  if (!parsed.success) return;

  const observedAt = new Date();
  await prisma.event.create({
    data: {
      companyId: access.company.id,
      userId: access.session.user.id,
      type: MARKETING_KPI_EVENT,
      metadata: JSON.stringify({
        source: "manual",
        observedAt: observedAt.toISOString(),
        ...parsed.data,
        actorRole: access.role,
      }),
    },
  });

  revalidatePath("/app");
  revalidatePath("/app/marketing");
  revalidatePath("/app/copilot");
}
