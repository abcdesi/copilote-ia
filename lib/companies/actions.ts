"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { rebuildBusinessGraph } from "@/lib/business-graph";
import { resolveKnownCompanyIdentities } from "@/lib/business-graph/entity-resolution";

const schema = z.object({
  name: z.string().min(1).max(120),
  industry: z.string().max(120).optional(),
  country: z.string().max(80).optional(),
  sizeRange: z.string().max(20).optional(),
  employeeCount: z.coerce.number().int().positive().optional(),
  objectives: z.string().max(2000).optional(),
  painPoints: z.string().max(2000).optional(),
});

async function refreshGraph(companyId: string) {
  await rebuildBusinessGraph(companyId);
  await resolveKnownCompanyIdentities(companyId);
  revalidatePath("/app/context");
}

export async function updateCompanyAction(formData: FormData) {
  const session = await requireSession();

  const parsed = schema.safeParse({
    name: formData.get("name"),
    industry: formData.get("industry") || undefined,
    country: formData.get("country") || undefined,
    sizeRange: formData.get("sizeRange") || undefined,
    employeeCount: formData.get("employeeCount") || undefined,
    objectives: formData.get("objectives") || undefined,
    painPoints: formData.get("painPoints") || undefined,
  });
  if (!parsed.success) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;

  await prisma.company.update({ where: { id: company.id }, data: parsed.data });
  await refreshGraph(company.id);
  revalidatePath("/app/company");
  revalidatePath("/app");
}

export async function addToolAction(formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;

  await prisma.companyTool.upsert({
    where: { companyId_name: { companyId: company.id, name } },
    update: {},
    create: { companyId: company.id, name, detected: false },
  });
  await refreshGraph(company.id);
  revalidatePath("/app/tools");
}

export async function removeToolAction(formData: FormData) {
  const session = await requireSession();
  const toolId = String(formData.get("toolId") ?? "");
  if (!toolId) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;

  await prisma.companyTool.deleteMany({ where: { id: toolId, companyId: company.id } });
  await refreshGraph(company.id);
  revalidatePath("/app/tools");
}
