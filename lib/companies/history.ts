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
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
}

function parseValue(value: string | null) {
  if (value == null) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function mapRevision(revision: {
  id: string;
  section: string;
  field: string;
  previousValueJson: string | null;
  nextValueJson: string | null;
  source: string;
  effectiveAt: Date;
  createdAt: Date;
}, actor?: { name?: string | null; email?: string | null; role?: string | null }): CompanyContextRevision {
  return {
    id: revision.id,
    section: revision.section,
    field: revision.field,
    previous: parseValue(revision.previousValueJson),
    next: parseValue(revision.nextValueJson),
    source: revision.source,
    effectiveAt: revision.effectiveAt.toISOString(),
    createdAt: revision.createdAt.toISOString(),
    actorName: actor?.name ?? null,
    actorEmail: actor?.email ?? null,
    actorRole: actor?.role ?? null,
  };
}

export async function getCompanyContextHistory(companyId: string, take = 120) {
  const revisions = await prisma.companyContextRevision.findMany({
    where: { companyId },
    orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    take,
  });
  return revisions.map(mapRevision);
}

export async function getCompanyContextHistoryPage(companyId: string, page = 1, pageSize = 40) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(10, pageSize));
  const [revisions, total] = await Promise.all([
    prisma.companyContextRevision.findMany({
      where: { companyId },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    prisma.companyContextRevision.count({ where: { companyId } }),
  ]);

  const actorByEffectiveAt = new Map<string, { name?: string | null; email?: string | null; role?: string | null }>();
  if (revisions.length > 0) {
    const times = revisions.map((revision) => revision.effectiveAt.getTime());
    const events = await prisma.event.findMany({
      where: {
        companyId,
        type: "COMPANY_CONTEXT_UPDATED",
        createdAt: {
          gte: new Date(Math.min(...times) - 60_000),
          lte: new Date(Math.max(...times) + 60_000),
        },
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    for (const event of events) {
      if (!event.metadata) continue;
      try {
        const metadata = JSON.parse(event.metadata) as { effectiveAt?: string; actorRole?: string };
        if (!metadata.effectiveAt) continue;
        actorByEffectiveAt.set(metadata.effectiveAt, {
          name: event.user?.name ?? null,
          email: event.user?.email ?? null,
          role: metadata.actorRole ?? null,
        });
      } catch {
        // Anciennes entrées sans métadonnées structurées : l'historique reste lisible.
      }
    }
  }

  return {
    items: revisions.map((revision) => mapRevision(revision, actorByEffectiveAt.get(revision.effectiveAt.toISOString()))),
    total,
    page: safePage,
    pageSize: safePageSize,
    pageCount: Math.max(1, Math.ceil(total / safePageSize)),
  };
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