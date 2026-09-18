"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireCompanyPermission } from "@/lib/companies/access";
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
  siret: optionalText(20),
  address: optionalText(300),
  phone: optionalText(40),
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
  activity: ["siret", "industry", "businessModel", "customerProfile"],
  team: ["sizeRange", "employeeCount"],
  objectives: ["objectives"],
  painPoints: ["painPoints"],
  applications: [],
  local: ["address", "phone", "country", "localContext"],
  finance: ["financeContext"],
  accounting: ["accountingContext"],
  sales: ["salesContext"],
  marketing: ["marketingContext"],
  hr: ["hrContext"],
  operations: ["operationsContext"],
};

const FIELD_SECTION: Record<keyof CompanyUpdate, KnowledgeSectionKey> = {
  name: "activity",
  siret: "activity",
  address: "local",
  phone: "local",
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

async function requireCompanyEditor() {
  try {
    return await requireCompanyPermission("edit_company");
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") return null;
    throw error;
  }
}

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
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

async function recordToolHistory(companyId: string, action: "added" | "removed", tool: string, effectiveAt: Date) {
  const previousValueJson = action === "removed" ? JSON.stringify(tool) : null;
  const nextValueJson = action === "added" ? JSON.stringify(tool) : null;
  await prisma.companyContextRevision.create({
    data: {
      companyId,
      section: "applications",
      field: "tool",
      previousValueJson,
      nextValueJson,
      source: "company_tools",
      effectiveAt,
    },
  });
}

async function trackContextChange(
  userId: string,
  companyId: string,
  actorRole: string,
  sections: KnowledgeSectionKey[],
  changedFields: string[],
  effectiveAt: Date,
  detail?: Record<string, unknown>
) {
  if (!sections.length) return;
  await track(EVENTS.COMPANY_CONTEXT_UPDATED, {
    userId,
    companyId,
    metadata: {
      sections: sections.join(","),
      fieldCount: changedFields.length,
      changedFields: changedFields.join(","),
      actorRole,
      effectiveAt: effectiveAt.toISOString(),
      ...detail,
    },
  });
}

export async function updateCompanyAction(formData: FormData) {
  const access = await requireCompanyEditor();
  if (!access) return;

  const parsed = schema.safeParse({
    name: formData.get("name"),
    siret: value(formData, "siret"),
    address: value(formData, "address"),
    phone: value(formData, "phone"),
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

  const company = await prisma.company.findUnique({ where: { id: access.company.id } });
  if (!company) return;

  const previous = company as unknown as Record<string, unknown>;
  const changes = changedSections(previous, parsed.data);
  if (changes.changedFields.length === 0) return;

  const effectiveAt = await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id: company.id }, data: parsed.data });
    const changedAt = new Date();
    await tx.companyContextRevision.createMany({
      data: changes.changedFields.map((field) => ({
        companyId: company.id,
        section: FIELD_SECTION[field],
        field,
        previousValueJson: serializeHistoryValue(previous[field as string]),
        nextValueJson: serializeHistoryValue(parsed.data[field]),
        source: "company_profile",
        effectiveAt: changedAt,
      })),
    });
    return changedAt;
  });
  await trackContextChange(
    access.session.user.id,
    company.id,
    access.role,
    changes.sections,
    changes.changedFields.map(String),
    effectiveAt
  );
  await refreshGraph(company.id);
  revalidatePath("/app/company");
  revalidatePath("/app");
  revalidatePath("/app/copilot");
  revalidatePath("/app/automations");
}

export async function addToolAction(formData: FormData) {
  const access = await requireCompanyEditor();
  if (!access) return;
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return;

  const existing = await prisma.companyTool.findUnique({ where: { companyId_name: { companyId: access.company.id, name } } });
  await prisma.companyTool.upsert({
    where: { companyId_name: { companyId: access.company.id, name } },
    update: {},
    create: { companyId: access.company.id, name, detected: false },
  });
  if (!existing) {
    const effectiveAt = new Date();
    await recordToolHistory(access.company.id, "added", name, effectiveAt);
    await trackContextChange(
      access.session.user.id,
      access.company.id,
      access.role,
      ["applications"],
      ["tool"],
      effectiveAt,
      { tool: name, toolAction: "added" }
    );
    await refreshGraph(access.company.id);
  }
  revalidatePath("/app/tools");
  revalidatePath("/app/company");
  revalidatePath("/app");
}

export async function removeToolAction(formData: FormData) {
  const access = await requireCompanyEditor();
  if (!access) return;
  const toolId = String(formData.get("toolId") ?? "");
  if (!toolId) return;

  const tool = await prisma.companyTool.findFirst({ where: { id: toolId, companyId: access.company.id } });
  const deleted = await prisma.companyTool.deleteMany({ where: { id: toolId, companyId: access.company.id } });
  if (deleted.count > 0) {
    const effectiveAt = new Date();
    if (tool) await recordToolHistory(access.company.id, "removed", tool.name, effectiveAt);
    await trackContextChange(
      access.session.user.id,
      access.company.id,
      access.role,
      ["applications"],
      ["tool"],
      effectiveAt,
      { tool: tool?.name ?? null, toolAction: "removed" }
    );
    await refreshGraph(access.company.id);
  }
  revalidatePath("/app/tools");
  revalidatePath("/app/company");
  revalidatePath("/app");
}
