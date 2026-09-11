"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  templateId: z.string().min(1).max(60),
});

export async function addProspectAction(formData: FormData) {
  const session = await requireSession();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    templateId: formData.get("templateId") || "relance-prospects",
  });
  if (!parsed.success) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;

  await prisma.prospect.create({
    data: {
      companyId: company.id,
      templateId: parsed.data.templateId,
      name: parsed.data.name,
      email: parsed.data.email,
    },
  });
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

const MAX_IMPORT_ROWS = 500;
const MAX_FILE_SIZE = 1_000_000; // 1 Mo — largement suffisant pour des listes de contacts texte

const rowSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
});

export async function importProspectsAction(formData: FormData) {
  const session = await requireSession();
  const templateId = String(formData.get("templateId") || "relance-prospects");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_SIZE) return;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return;

  const text = await file.text();
  const rawRows = parseContactFile(text);

  const existing = await prisma.prospect.findMany({
    where: { companyId: company.id, templateId },
    select: { email: true },
  });
  const seen = new Set(existing.map((p) => p.email.toLowerCase()));

  const toCreate: { companyId: string; templateId: string; name: string; email: string }[] = [];
  for (const raw of rawRows) {
    if (toCreate.length >= MAX_IMPORT_ROWS) break;
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) continue;
    const emailKey = parsed.data.email.toLowerCase();
    if (seen.has(emailKey)) continue;
    seen.add(emailKey);
    toCreate.push({ companyId: company.id, templateId, name: parsed.data.name, email: parsed.data.email });
  }

  if (toCreate.length > 0) {
    await prisma.prospect.createMany({ data: toCreate });
  }
  revalidatePath("/app/automations");
}

// Accepte soit un JSON (tableau d'objets {name, email}), soit un CSV simple avec une
// ligne d'en-tête "name,email" (ou "nom,email"). Volontairement basique — pas de
// gestion de guillemets échappés/virgules imbriquées, ce n'est qu'une liste de contacts.
function parseContactFile(text: string): { name: unknown; email: unknown }[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      const arr = Array.isArray(json) ? json : [json];
      return arr.map((row) => ({
        name: row?.name ?? row?.Name ?? row?.nom,
        email: row?.email ?? row?.Email,
      }));
    } catch {
      // Pas du JSON valide malgré l'apparence — on retente en CSV ci-dessous.
    }
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const splitLine = (line: string) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  const nameIdx = header.indexOf("name") !== -1 ? header.indexOf("name") : header.indexOf("nom");
  const emailIdx = header.indexOf("email");
  const hasHeader = nameIdx !== -1 && emailIdx !== -1;

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const [nIdx, eIdx] = hasHeader ? [nameIdx, emailIdx] : [0, 1];

  return dataLines.map((line) => {
    const cols = splitLine(line);
    return { name: cols[nIdx], email: cols[eIdx] };
  });
}
