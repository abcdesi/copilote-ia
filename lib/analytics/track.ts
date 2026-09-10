import { prisma } from "@/lib/db/client";
import { EventType } from "./events";

// Métadonnées minimisées uniquement : jamais de contenu de message, nom de contact,
// adresse email de tiers ou autre PII brute. Catégories et identifiants techniques seulement.
type EventMetadata = Record<string, string | number | boolean | null>;

export async function track(
  type: EventType,
  opts: { userId?: string; companyId?: string; metadata?: EventMetadata } = {}
) {
  try {
    await prisma.event.create({
      data: {
        type,
        userId: opts.userId,
        companyId: opts.companyId,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    });
  } catch {
    // L'analytics ne doit jamais casser le parcours utilisateur.
  }
}
