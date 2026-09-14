import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/client";

export type IdentityKind = "email" | "phone" | "domain" | "external_id";

export interface ResolveIdentityInput {
  companyId: string;
  entityType: string;
  displayName: string;
  provider: string;
  kind: IdentityKind;
  value: string;
  sourceRef: string;
  confidence?: number;
  verified?: boolean;
  attributes?: Record<string, unknown>;
  preferredEntityId?: string;
}

export interface EntityResolutionSummary {
  identityCount: number;
  personEntityCount: number;
  multiIdentityEntityCount: number;
  multiProviderEntityCount: number;
  providerCount: number;
}

function normalizeIdentifier(kind: IdentityKind, value: string) {
  const trimmed = value.trim();
  if (kind === "email") return trimmed.toLowerCase();
  if (kind === "phone") return trimmed.replace(/[^0-9+]/g, "");
  if (kind === "domain") return trimmed.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return trimmed.toLowerCase();
}

function fingerprint(kind: IdentityKind, normalizedValue: string) {
  return createHash("sha256").update(`${kind}:${normalizedValue}`, "utf8").digest("hex");
}

function displayHint(kind: IdentityKind, normalizedValue: string) {
  if (kind === "email") {
    const [local, domain] = normalizedValue.split("@");
    if (!domain) return "email masqué";
    const initial = local?.slice(0, 1) || "*";
    return `${initial}***@${domain}`;
  }
  if (kind === "phone") {
    const suffix = normalizedValue.slice(-4);
    return suffix ? `••••${suffix}` : "téléphone masqué";
  }
  if (kind === "domain") return normalizedValue;
  return `${normalizedValue.slice(0, 3)}…${normalizedValue.slice(-3)}`;
}

function safeAttributes(attributes?: Record<string, unknown>) {
  if (!attributes) return null;
  const blocked = new Set(["email", "phone", "token", "accessToken", "refreshToken", "secret", "password"]);
  return JSON.stringify(
    Object.fromEntries(Object.entries(attributes).filter(([key]) => !blocked.has(key)))
  );
}

function canonicalKey(entityType: string, kind: IdentityKind, identityFingerprint: string) {
  return `${entityType}:${kind}:${identityFingerprint.slice(0, 32)}`;
}

async function refreshSourceCount(entityId: string) {
  const identities = await prisma.businessIdentity.findMany({
    where: { entityId },
    select: { provider: true },
  });
  const providerCount = new Set(identities.map((identity) => identity.provider)).size;
  await prisma.businessEntity.update({
    where: { id: entityId },
    data: { sourceCount: Math.max(1, providerCount), lastSeenAt: new Date() },
  });
  return providerCount;
}

/**
 * Résout une identité source vers une entité canonique.
 *
 * Politique MVP :
 * - fusion automatique uniquement sur un identifiant déterministe normalisé (email, téléphone, domaine, id externe) ;
 * - jamais de fusion automatique sur le nom seul ;
 * - aucune valeur sensible n'est stockée dans BusinessIdentity : uniquement une empreinte + un indice masqué ;
 * - la provenance source reste attachée à chaque identité.
 */
export async function resolveIdentity(input: ResolveIdentityInput) {
  const normalizedValue = normalizeIdentifier(input.kind, input.value);
  if (!normalizedValue) throw new Error("Identifiant vide.");
  if (input.kind === "email" && !normalizedValue.includes("@")) throw new Error("Email invalide.");

  const identityFingerprint = fingerprint(input.kind, normalizedValue);
  const confidence = Math.max(0, Math.min(1, input.confidence ?? 1));
  const observedAt = new Date();

  const existingBinding = await prisma.businessIdentity.findUnique({
    where: {
      companyId_provider_kind_sourceRef: {
        companyId: input.companyId,
        provider: input.provider,
        kind: input.kind,
        sourceRef: input.sourceRef,
      },
    },
    include: { entity: true },
  });

  const exactMatch = await prisma.businessIdentity.findFirst({
    where: {
      companyId: input.companyId,
      kind: input.kind,
      fingerprint: identityFingerprint,
      ...(existingBinding ? { id: { not: existingBinding.id } } : {}),
    },
    include: { entity: true },
    orderBy: [{ verified: "desc" }, { confidence: "desc" }, { createdAt: "asc" }],
  });

  let entity = exactMatch?.entity ?? null;
  let resolutionMethod: "exact_identifier" | "preferred_entity" | "existing_source" | "new_entity" = exactMatch
    ? "exact_identifier"
    : input.preferredEntityId
      ? "preferred_entity"
      : existingBinding
        ? "existing_source"
        : "new_entity";

  if (!entity && input.preferredEntityId) {
    entity = await prisma.businessEntity.findFirst({
      where: { id: input.preferredEntityId, companyId: input.companyId },
    });
    if (!entity) resolutionMethod = existingBinding ? "existing_source" : "new_entity";
  }

  if (!entity && existingBinding) entity = existingBinding.entity;

  if (!entity) {
    entity = await prisma.businessEntity.upsert({
      where: {
        companyId_type_canonicalKey: {
          companyId: input.companyId,
          type: input.entityType,
          canonicalKey: canonicalKey(input.entityType, input.kind, identityFingerprint),
        },
      },
      create: {
        companyId: input.companyId,
        type: input.entityType,
        canonicalKey: canonicalKey(input.entityType, input.kind, identityFingerprint),
        name: input.displayName,
        status: "active",
        attributesJson: safeAttributes(input.attributes),
        confidence,
        sourceCount: 1,
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
      },
      update: {
        name: input.displayName,
        status: "active",
        attributesJson: safeAttributes(input.attributes),
        confidence: { set: confidence },
        lastSeenAt: observedAt,
      },
    });
  } else {
    await prisma.businessEntity.update({
      where: { id: entity.id },
      data: {
        name: input.displayName || entity.name,
        lastSeenAt: observedAt,
        confidence: Math.max(entity.confidence, confidence),
        ...(input.attributes ? { attributesJson: safeAttributes(input.attributes) } : {}),
      },
    });
  }

  const identity = await prisma.businessIdentity.upsert({
    where: {
      companyId_provider_kind_sourceRef: {
        companyId: input.companyId,
        provider: input.provider,
        kind: input.kind,
        sourceRef: input.sourceRef,
      },
    },
    create: {
      companyId: input.companyId,
      entityId: entity.id,
      provider: input.provider,
      kind: input.kind,
      fingerprint: identityFingerprint,
      displayHint: displayHint(input.kind, normalizedValue),
      sourceRef: input.sourceRef,
      confidence,
      verified: input.verified ?? false,
      observedAt,
    },
    update: {
      entityId: entity.id,
      fingerprint: identityFingerprint,
      displayHint: displayHint(input.kind, normalizedValue),
      confidence,
      verified: input.verified ?? existingBinding?.verified ?? false,
      observedAt,
    },
  });

  const providerCount = await refreshSourceCount(entity.id);
  if (existingBinding && existingBinding.entityId !== entity.id) {
    await refreshSourceCount(existingBinding.entityId).catch(() => undefined);
  }

  await prisma.event.create({
    data: {
      companyId: input.companyId,
      type: "ENTITY_IDENTITY_RESOLVED",
      metadata: JSON.stringify({
        entityType: input.entityType,
        provider: input.provider,
        kind: input.kind,
        resolutionMethod,
        providerCount,
        verified: input.verified ?? false,
      }),
    },
  });

  return { entityId: entity.id, identityId: identity.id, resolutionMethod, providerCount };
}

export async function resolveKnownCompanyIdentities(companyId: string) {
  const [prospects, connections] = await Promise.all([
    prisma.prospect.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
    prisma.integrationConnection.findMany({ where: { companyId } }),
  ]);

  let resolved = 0;
  for (const prospect of prospects) {
    if (!prospect.email?.trim()) continue;
    await resolveIdentity({
      companyId,
      entityType: "person",
      displayName: prospect.name || "Contact",
      provider: "pilotzia",
      kind: "email",
      value: prospect.email,
      sourceRef: `prospect:${prospect.id}`,
      confidence: 0.98,
      attributes: {
        role: "prospect",
        status: prospect.status,
        templateId: prospect.templateId,
        lastContactedAt: prospect.lastContactedAt?.toISOString() ?? null,
      },
    });
    resolved += 1;
  }

  for (const connection of connections) {
    const label = connection.accountLabel?.trim() ?? "";
    let preferredEntityId: string | undefined;

    if (label.includes("@")) {
      const result = await resolveIdentity({
        companyId,
        entityType: "person",
        displayName: label.split("@")[0] || connection.provider,
        provider: connection.provider,
        kind: "email",
        value: label,
        sourceRef: `connection:${connection.id}:account-email`,
        confidence: 1,
        verified: true,
        attributes: { role: "connected_account", connectionStatus: connection.status },
      });
      preferredEntityId = result.entityId;
      resolved += 1;
    }

    if (connection.externalAccountId) {
      await resolveIdentity({
        companyId,
        entityType: "person",
        displayName: label || `${connection.provider} account`,
        provider: connection.provider,
        kind: "external_id",
        value: connection.externalAccountId,
        sourceRef: `connection:${connection.id}:external-id`,
        confidence: 1,
        verified: true,
        preferredEntityId,
        attributes: { role: "connected_account", connectionStatus: connection.status },
      });
      resolved += 1;
    }
  }

  return { resolved, summary: await getEntityResolutionSummary(companyId) };
}

export async function getEntityResolutionSummary(companyId: string): Promise<EntityResolutionSummary> {
  const [identityCount, personEntityCount, identities] = await Promise.all([
    prisma.businessIdentity.count({ where: { companyId } }),
    prisma.businessEntity.count({ where: { companyId, type: "person" } }),
    prisma.businessIdentity.findMany({
      where: { companyId },
      select: { entityId: true, provider: true },
    }),
  ]);

  const byEntity = new Map<string, { identities: number; providers: Set<string> }>();
  const providers = new Set<string>();
  for (const identity of identities) {
    providers.add(identity.provider);
    const current = byEntity.get(identity.entityId) ?? { identities: 0, providers: new Set<string>() };
    current.identities += 1;
    current.providers.add(identity.provider);
    byEntity.set(identity.entityId, current);
  }

  return {
    identityCount,
    personEntityCount,
    multiIdentityEntityCount: [...byEntity.values()].filter((entry) => entry.identities > 1).length,
    multiProviderEntityCount: [...byEntity.values()].filter((entry) => entry.providers.size > 1).length,
    providerCount: providers.size,
  };
}
