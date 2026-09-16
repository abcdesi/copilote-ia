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

function parseValue(value: string | null) {
  if (value == null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

export async function getCompanyContextHistory(companyId: string, take = 120) {
  const revisions = await prisma.companyContextRevision.findMany({
    where: { companyId },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    take,
  });

  return revisions.map((revision) => ({
    id: revision.id,
    section: revision.section,
    field: revision.field,
    previous: parseValue(revision.previousValueJson),
    next: parseValue(revision.nextValueJson),
    source: revision.source,
    effectiveAt: revision.effectiveAt.toISOString(),
    createdAt: revision.createdAt.toISOString(),
  } satisfies CompanyContextRevision));
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