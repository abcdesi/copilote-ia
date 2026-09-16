import { prisma } from "@/lib/db/client";

export interface CompanyContextRevision {
  id: string;
  section: string;
  field: string;
  previous: unknown;
  next: unknown;
  source: string;
  effectiveAt: string;
  createdAt: string;
}

function parseRevision(id: string, metadata: string | null, createdAt: Date): CompanyContextRevision | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    if (typeof parsed.section !== "string" || typeof parsed.field !== "string") return null;
    return {
      id,
      section: parsed.section,
      field: parsed.field,
      previous: parsed.previous ?? null,
      next: parsed.next ?? null,
      source: typeof parsed.source === "string" ? parsed.source : "unknown",
      effectiveAt: typeof parsed.effectiveAt === "string" ? parsed.effectiveAt : createdAt.toISOString(),
      createdAt: createdAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getCompanyContextHistory(companyId: string, take = 120) {
  const events = await prisma.event.findMany({
    where: { companyId, type: "COMPANY_CONTEXT_REVISION" },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, metadata: true, createdAt: true },
  });
  return events.map((event) => parseRevision(event.id, event.metadata, event.createdAt)).filter((item): item is CompanyContextRevision => Boolean(item));
}

function compactValue(value: unknown, max = 180) {
  if (value == null || value === "") return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

export function compactHistoryForContext(history: CompanyContextRevision[], relevantSections?: string[]) {
  const selected = relevantSections?.length
    ? history.filter((revision) => relevantSections.includes(revision.section) || ["objectives", "painPoints", "activity"].includes(revision.section))
    : history;

  const seen = new Set<string>();
  return selected
    .filter((revision) => {
      const key = `${revision.section}:${revision.field}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12)
    .map((revision) => ({
      s: revision.section,
      f: revision.field,
      at: revision.effectiveAt,
      from: compactValue(revision.previous),
      to: compactValue(revision.next),
    }));
}

export function summarizeHistoryForUi(history: CompanyContextRevision[], take = 12) {
  return history.slice(0, take).map((revision) => ({
    id: revision.id,
    section: revision.section,
    field: revision.field,
    at: revision.effectiveAt,
    previous: compactValue(revision.previous, 120),
    next: compactValue(revision.next, 120),
  }));
}