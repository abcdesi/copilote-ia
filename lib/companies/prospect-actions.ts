"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
});

export async function addProspectAction(formData: FormData) {
  const session = await requireSession();
  const parsed = schema.safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!parsed.success) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;

  await prisma.prospect.create({ data: { companyId: company.id, name: parsed.data.name, email: parsed.data.email } });
  revalidatePath("/app/automations");
}

export async function deleteProspectAction(formData: FormData) {
  const session = await requireSession();
  const prospectId = String(formData.get("prospectId") ?? "");
  if (!prospectId) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;

  await prisma.prospect.deleteMany({ where: { id: prospectId, companyId: company.id } });
  revalidatePath("/app/automations");
}
