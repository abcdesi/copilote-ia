"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { rebuildBusinessGraph } from "@/lib/business-graph";
import { syncBusinessRhythms } from "@/lib/business-graph/rhythms";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import type { KnowledgeSectionKey } from "@/lib/companies/knowledge-model";

const optionalText = (max = 4000) => z.string().max(max).nullable().optional();
const optionalEmployeeCount = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number().int().positive().nullable().optional()
);

const schema = z.object({
  name: z.string().min(1).max(120),
  industry: optionalText(120),
  country: optionalText(80),
  sizeRange: optionalText(20),
  employeeCount: optionalEmployeeCount,
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

type CompanyUpdate = z.infer<typeof schema>;
type ProfileField = Exclude<keyof CompanyUpdate, "name">;

const SECTION_FIELDS: Record<KnowledgeSectionKey, ProfileField[]> = {
  activity: ["industry", "businessModel", "customerProfile"],
  team: ["sizeRange", "employeeCount"],
  objectives: ["objectives"],
  painPoints: ["painPoints"],
  applications: [],
  local: ["country", "localContext"],
  finance: ["financeContext"],
  accounting: ["accountingContext"],
  sales: ["salesContext"],
  marketing: ["marketingContext"],
  hr: ["hrContext"],
  operations: ["operationsContext"],
};

const FIELD_SECTION: Record<keyof CompanyUpdate, KnowledgeSectionKey> = {
  name: "activity",
  industry: "activity",
  country: "local",
  sizeRange: "team",
  employeeCount: "team",
  objectives: "objectives",
  painPoints: "painPoints",
  businessModel: "activity",
  customerProfile: "activity",
  localContext: "local",
  financeContext: "finance",
  marketingContext: "marketing",
  accountingContext: "accounting",
  salesContext: "sales",
  hrContext: "hr",
  operationsContext: "operations",
};

async function refreshGraph(companyId: string) {
  await rebuildBusinessGraph(companyId);
  await syncBusinessRhythms(companyId);
  revalidatePath("/app/context");
}

function value(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  return raw || null;
}

function normalizedComparable(value: unknown) {
  if (value == null || value === "") return null;
  return value;
}

function changedSections(previous: Record<string, unknown>, next: CompanyUpdate) {
  const changedFields = (Object.keys(next) as Array<keyof CompanyUpdate>).filter(
    (field) => normalizedComparable(previous[field as string]) !== normalizedComparable(next[field])
  );
  const sections = (Object.keys(SECTION_FIELDS) as KnowledgeSectionKey[]).filter((section) =>
    SECTION_FIELDS[section].some((field) => changedFields.includes(field))
  );
  return { changedFields, sections };
}

function serializeHistoryValue(value: unknown) {
  if (value === undefined) return null;
  return value;
}

async function recordContextHistory(
  userId: string,
  companyId: string,
  previous: Record<string, unknown>,
  next: CompanyUpdate,
  changedFields: Array<keyof CompanyUpdate>
) {
  if (!changedFields.length) return;
  const effectiveAt = new Date().toISOString();
  await prisma.event.createMany({
    data: changedFields.map((field) => ({
      type: "COMPANY_CONTEXT_REVISION",
      userId,
      companyId,
      metadata: JSON.stringify({
        v: 1,
        section: FIELD_SECTION[field],
        field,
        previous: serializeHistoryValue(previous[field as string]),
        next: serializeHistoryValue(next[field]),
        source: "company_profile",
        effectiveAt,
      }),
    })),
  });
}

async function recordToolHistory(
  userId: string,
  companyId: string,
  action: "added" | "removed",
  tool: string
) {
  await prisma.event.create({
    data: {
      type: "COMPANY_CONTEXT_REVISION",
      userId,
      companyId,
      metadata: JSON.stringify({
        v: 1,
        section: "applications",
        field: "tool",
        previous: action === "removed" ? tool : null,
        next: action === "added" ? tool : null,
        source: "company_tools",
        effectiveAt: new Date().toISOString(),
      }),
    },
  });
}

async function trackContextChange(userId: string, companyId: string, sections: KnowledgeSectionKey[], fieldCount: number) {
  if (!sections.length) return;
  await track(EVENTS.COMPANY_CONTEXT_UPDATED, {
    userId,
    companyId,
    metadata: {
      sections: sections.join(","),
      fieldCount,
    },
  });
}

export async function updateCompanyAction(formData: FormData) {
  const session = await requireSession();

  const parsed = schema.safeParse({
    name: formData.get("name"),
    industry: value(formData, "industry"),
    country: value(formData, "country"),
    sizeRange: value(formData, "sizeRange"),
    employeeCount: String(formData.get("employeeCount") ?? "").trim(),
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

  const previous = company as unknown as Record<string, unknown>;
  const changes = changedSections(previous, parsed.data);
  await prisma.company.update({ where: { id: company.id }, data: parsed.data });
  await recordContextHistory(session.user.id, company.id, previous, parsed.data, changes.changedFields);
  await trackContextChange(session.user.id, company.id, changes.sections, changes.changedFields.length);
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

  const existing = await prisma.companyTool.findUnique({ where: { companyId_name: { companyId: company.id, name } } });
  await prisma.companyTool.upsert({
    where: { companyId_name: { companyId: company.id, name } },
    update: {},
    create: { companyId: company.id, name, detected: false },
  });
  if (!existing) await recordToolHistory(session.user.id, company.id, "added", name);
  await trackContextChange(session.user.id, company.id, ["applications"], 1);
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

  const tool = await prisma.companyTool.findFirst({ where: { id: toolId, companyId: company.id } });
  const deleted = await prisma.companyTool.deleteMany({ where: { id: toolId, companyId: company.id } });
  if (deleted.count > 0) {
    if (tool) await recordToolHistory(session.user.id, company.id, "removed", tool.name);
    await trackContextChange(session.user.id, company.id, ["applications"], 1);
  }
  await refreshGraph(company.id);
  revalidatePath("/app/tools");
  revalidatePath("/app/company");
  revalidatePath("/app");
}