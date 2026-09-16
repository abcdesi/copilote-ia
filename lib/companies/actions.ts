"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { rebuildBusinessGraph } from "@/lib/business-graph";

const optionalText = (max = 4000) => z.string().max(max).optional();

const schema = z.object({
  name: z.string().min(1).max(120),
  industry: optionalText(120),
  country: optionalText(80),
  sizeRange: optionalText(20),
  employeeCount: z.coerce.number().int().positive().optional(),
  objectives: optionalText(),
  painPoints: optionalText(),
  businessModel: optionalText(),
  customerProfile: optionalText(),
  localContext: optionalText(),
  financeContext: optionalText(),
  marketingContext: optionalText(),
  accountingContext: optionalText(),
  salesContext: optionalText(),
  hrContext: optionalText(),
  operationsContext: optionalText(),
});

async function refreshGraph(companyId: string) {
  await rebuildBusinessGraph(companyId);
  revalidatePath("/app/context");
}

function value(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  return raw || undefined;
}

export async function updateCompanyAction(formData: FormData) {
  const session = await requireSession();

  const parsed = schema.safeParse({
    name: formData.get("name"),
    industry: value(formData, "industry"),
    country: value(formData, "country"),
    sizeRange: value(formData, "sizeRange"),
    employeeCount: value(formData, "employeeCount"),
    objectives: value(formData, "objectives"),
    painPoints: value(formData, "painPoints"),
    businessModel: value(formData, "businessModel"),
    customerProfile: value(formData, "customerProfile"),
    localContext: value(formData, "localContext"),
    financeContext: value(formData, "financeContext"),
    marketingContext: value(formData, "marketingContext"),
    accountingContext: value(formData, "accountingContext"),
    salesContext: value(formData, "salesContext"),
    hrContext: value(formData, "hrContext"),
    operationsContext: value(formData, "operationsContext"),
  });
  if (!parsed.success) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;

  await prisma.company.update({ where: { id: company.id }, data: parsed.data });
  await refreshGraph(company.id);
  revalidatePath("/app/company");
  revalidatePath("/app");
  revalidatePath("/app/copilot");
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
  revalidatePath("/app/company");
  revalidatePath("/app");
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
  revalidatePath("/app/company");
  revalidatePath("/app");
}
