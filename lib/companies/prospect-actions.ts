"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireCompanyPermission } from "@/lib/companies/access";
import { getRealExecutionConfig } from "@/lib/n8n/real-execution-config";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(254),
  templateId: z.string().min(1).max(60),
});

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

async function auditContactChange(input: {
  automationId?: string | null;
  access: Awaited<ReturnType<typeof requireCompanyPermission>>;
  eventType: string;
  details: Record<string, unknown>;
}) {
  if (!input.automationId) return;
  await prisma.automationAuditEvent.create({
    data: {
      automationId: input.automationId,
      actorUserId: input.access.session.user.id,
      actorName: input.access.session.user.name ?? null,
      actorEmail: input.access.session.user.email ?? null,
      actorRole: input.access.role,
      eventType: input.eventType,
      detailsJson: JSON.stringify(input.details),
    },
  });
}

export async function addProspectAction(formData: FormData) {
  const access = await requireCompanyPermission("manage_contacts");
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    templateId: formData.get("templateId") || "relance-prospects",
  });
  if (!parsed.success || !getRealExecutionConfig(parsed.data.templateId)) return;

  const email = normalizedEmail(parsed.data.email);
  const existing = await prisma.prospect.findFirst({
    where: { companyId: access.company.id, templateId: parsed.data.templateId, email: { equals: email, mode: "insensitive" } },
  });
  const automation = await prisma.automation.findFirst({
    where: { companyId: access.company.id, templateId: parsed.data.templateId },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    // Une exclusion est une décision explicite : un simple ajout/import ne la contourne pas.
    if (existing.status === "excluded") throw new Error("CONTACT_EXCLUDED_REQUIRES_EXPLICIT_REACTIVATION");
    if (existing.name !== parsed.data.name || existing.email !== email) {
      await prisma.prospect.update({ where: { id: existing.id }, data: { name: parsed.data.name, email } });
      await auditContactChange({
        automationId: automation?.id,
        access,
        eventType: "contact_updated",
        details: { prospectId: existing.id, email },
      });
    }
  } else {
    const created = await prisma.prospect.create({
      data: { companyId: access.company.id, templateId: parsed.data.templateId, name: parsed.data.name, email },
    });
    await auditContactChange({
      automationId: automation?.id,
      access,
      eventType: "contact_added",
      details: { prospectId: created.id, email },
    });
  }
  revalidatePath("/app/automations");
}

// Compatibilité avec l'ancienne UI : le bouton "supprimer" archive désormais le contact.
export async function deleteProspectAction(formData: FormData) {
  const access = await requireCompanyPermission("manage_contacts");
  const prospectId = String(formData.get("prospectId") ?? "");
  if (!prospectId) return;

  const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, companyId: access.company.id } });
  if (!prospect) return;
  const automation = await prisma.automation.findFirst({
    where: { companyId: access.company.id, templateId: prospect.templateId },
    orderBy: { createdAt: "desc" },
  });

  if (prospect.status !== "excluded") {
    await prisma.prospect.update({
      where: { id: prospect.id },
      data: { status: "excluded", archivedAt: new Date(), lastOutcome: prospect.lastOutcome ?? "excluded_by_user" },
    });
    await auditContactChange({
      automationId: automation?.id,
      access,
      eventType: "contact_excluded",
      details: { prospectId: prospect.id, email: prospect.email, source: "remove_button" },
    });
  }
  revalidatePath("/app/automations");
}

const MAX_IMPORT_ROWS = 500;
const MAX_FILE_SIZE = 1_000_000;
const rowSchema = z.object({ name: z.string().min(1).max(120), email: z.string().email().max(254) });

export async function importProspectsAction(formData: FormData) {
  const access = await requireCompanyPermission("manage_contacts");
  const templateId = String(formData.get("templateId") || "relance-prospects");
  const file = formData.get("file");
  if (!getRealExecutionConfig(templateId)) return;
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_SIZE) return;

  const text = await file.text();
  const rawRows = parseContactFile(text).slice(0, MAX_IMPORT_ROWS);
  const existing = await prisma.prospect.findMany({
    where: { companyId: access.company.id, templateId },
    select: { id: true, email: true, status: true },
  });
  const existingByEmail = new Map(existing.map((p) => [normalizedEmail(p.email), p]));
  const seenInFile = new Set<string>();

  const toCreate: { companyId: string; templateId: string; name: string; email: string }[] = [];
  let invalidRows = 0;
  let duplicateRows = 0;
  let excludedSkipped = 0;
  for (const raw of rawRows) {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      invalidRows += 1;
      continue;
    }
    const email = normalizedEmail(parsed.data.email);
    if (seenInFile.has(email)) {
      duplicateRows += 1;
      continue;
    }
    seenInFile.add(email);
    const previous = existingByEmail.get(email);
    if (previous) {
      if (previous.status === "excluded") excludedSkipped += 1;
      else duplicateRows += 1;
      continue;
    }
    toCreate.push({ companyId: access.company.id, templateId, name: parsed.data.name, email });
  }

  if (toCreate.length > 0) await prisma.prospect.createMany({ data: toCreate });

  const automation = await prisma.automation.findFirst({
    where: { companyId: access.company.id, templateId },
    orderBy: { createdAt: "desc" },
  });
  await auditContactChange({
    automationId: automation?.id,
    access,
    eventType: "contacts_imported",
    details: {
      filename: file.name.slice(0, 220),
      fileHash: createHash("sha256").update(text).digest("hex"),
      parsedRows: rawRows.length,
      createdRows: toCreate.length,
      invalidRows,
      duplicateRows,
      excludedSkipped,
    },
  });
  revalidatePath("/app/automations");
}

function parseContactFile(text: string): { name: unknown; email: unknown }[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      const arr = Array.isArray(json) ? json : [json];
      return arr.map((row) => ({ name: row?.name ?? row?.Name ?? row?.nom, email: row?.email ?? row?.Email }));
    } catch {
      // On tente ensuite le CSV.
    }
  }

  const rows = parseCsv(trimmed);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const nameIdx = header.indexOf("name") !== -1 ? header.indexOf("name") : header.indexOf("nom");
  const emailIdx = header.indexOf("email");
  const hasHeader = nameIdx !== -1 && emailIdx !== -1;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const [nIdx, eIdx] = hasHeader ? [nameIdx, emailIdx] : [0, 1];
  return dataRows.filter((row) => row.some((cell) => cell.trim())).map((row) => ({ name: row[nIdx], email: row[eIdx] }));
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim().replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.trim().replace(/\r$/, ""));
  rows.push(row);
  return rows;
}
