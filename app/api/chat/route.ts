import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { buildChatContext } from "@/lib/companies/context";
import { getOrCreateTodayConversation } from "@/lib/companies/conversations";
import { runChat } from "@/lib/ai";
import { inferConversationIntent } from "@/lib/ai/expert-response-policy";
import { getTemplateById } from "@/lib/automations/catalog";
import { mentionedAutomationTemplateIds } from "@/lib/automations/recommendation-match";
import { isRealExecutionTemplate } from "@/lib/n8n/real-execution-config";
import { isN8nConfigured } from "@/lib/n8n/client";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import { HOURLY_RATE_EUR } from "@/lib/automations/types";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { AI_USAGE_RESERVE_EUR, refundUsage, reserveUsage } from "@/lib/billing/usage-policy";

const bodySchema = z.object({ message: z.string().trim().min(1).max(1000) });

export interface CopilotAction {
  kind: "navigate";
  label: string;
  href: string;
  description?: string;
  requiresConfirmation?: boolean;
  automationReadiness?: "ready" | "configuration_required" | "not_executable";
}

function isSmartRequest(message: string) {
  const intent = inferConversationIntent(message);
  return (
    message.length > 420 ||
    (intent !== "general" && intent !== "automation") ||
    /analyse|stratég|strategie|plan|compare|diagnostic|priorit|pourquoi|optimis|audit|finance|financier|bilan|compte de résultat|compte de resultat|roi|risque|direction|conseil/i.test(
      message
    )
  );
}

async function recordMessageTrace(input: {
  companyId: string;
  messageId: string;
  conversationId: string;
  role: "user" | "assistant";
  userId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole: string;
}) {
  await prisma.event.create({
    data: {
      companyId: input.companyId,
      userId: input.userId ?? null,
      type: "COPILOT_MESSAGE_CREATED",
      metadata: JSON.stringify({
        messageId: input.messageId,
        conversationId: input.conversationId,
        role: input.role,
        actorName: input.actorName ?? null,
        actorEmail: input.actorEmail ?? null,
        actorRole: input.actorRole,
      }),
    },
  });
}

async function createAssistantMessage(companyId: string, conversationId: string, content: string) {
  const message = await prisma.chatMessage.create({
    data: { companyId, conversationId, role: "assistant", content },
  });
  await recordMessageTrace({
    companyId,
    messageId: message.id,
    conversationId,
    role: "assistant",
    actorName: "Pilotzia",
    actorRole: "system",
  }).catch(() => undefined);
  return message;
}

export async function POST(req: NextRequest) {
  const access = await getCurrentCompanyAccess();
  const { company, session, role } = access;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }

  const conversation = await getOrCreateTodayConversation(company.id, session.user.id);

  const userMessage = await prisma.chatMessage.create({
    data: { companyId: company.id, conversationId: conversation.id, role: "user", content: parsed.data.message },
  });
  await recordMessageTrace({
    companyId: company.id,
    messageId: userMessage.id,
    conversationId: conversation.id,
    role: "user",
    userId: session.user.id,
    actorName: session.user.name,
    actorEmail: session.user.email,
    actorRole: role,
  }).catch(() => undefined);

  const history = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const context = await buildChatContext(company.id);
  const smart = isSmartRequest(parsed.data.message);
  const credits = smart ? 3 : 1;
  const reservedCostEur = smart ? AI_USAGE_RESERVE_EUR.smart : AI_USAGE_RESERVE_EUR.fast;
  const kind = smart ? ("ai_smart" as const) : ("ai_fast" as const);
  const providerConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const usage = providerConfigured
    ? await reserveUsage({ companyId: company.id, kind, credits, reservedCostEur })
    : { allowed: true as const, paid: false as const, reservationId: null };

  if (!usage.allowed) {
    const isPaidLimit = usage.reason === "plan_credits_exhausted" || usage.reason === "plan_cost_cap_reached";
    const reply = isPaidLimit
      ? "Votre enveloppe mensuelle d'usage intelligent est arrivée à sa limite. Pilotzia conserve tout votre contexte et votre historique. Vous pouvez acheter des crédits supplémentaires ou passer à l'offre supérieure."
      : "Votre essai Pilotzia est arrivé à sa limite. Votre contexte, vos connexions et votre historique restent conservés. Activez un abonnement pour reprendre les analyses IA sans repartir de zéro.";

    await createAssistantMessage(company.id, conversation.id, reply);
    await track(EVENTS.RECOMMENDATION_SHOWN, {
      companyId: company.id,
      metadata: { source: "usage_limit", reason: usage.reason },
    });
    return NextResponse.json({
      reply,
      action: {
        kind: "navigate",
        label: isPaidLimit ? "Gérer mes crédits" : "Voir les offres Pilotzia",
        href: "/app/settings",
        description: isPaidLimit
          ? "Achetez un pack de crédits ou comparez l'offre supérieure."
          : "Votre contexte reste intact. L'abonnement réactive le copilote et l'usage continu.",
      } satisfies CopilotAction,
      usageLimited: true,
      usageReason: usage.reason,
    });
  }

  let chatResult: Awaited<ReturnType<typeof runChat>>;
  try {
    chatResult = await runChat(
      history
        .slice()
        .reverse()
        .map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
      context
    );
  } catch (error) {
    if (providerConfigured) {
      await refundUsage({
        companyId: company.id,
        reservationId: usage.reservationId,
        kind,
        credits,
        reservedCostEur,
      }).catch(() => undefined);
    }
    console.error("Copilot AI call failed", error);
    const reply = "Le copilote est temporairement indisponible. Aucun crédit n'a été consommé pour cette tentative. Réessayez dans quelques instants.";
    await createAssistantMessage(company.id, conversation.id, reply);
    return NextResponse.json({ reply, retryable: true, creditsRefunded: true }, { status: 503 });
  }

  const { reply, matchedTemplateId, matchedTemplateSource } = chatResult;
  const assistantMessage = await createAssistantMessage(company.id, conversation.id, reply);

  const recommendedTemplateIds = Array.from(
    new Set([
      ...(matchedTemplateId ? [matchedTemplateId] : []),
      ...mentionedAutomationTemplateIds(reply),
    ])
  ).slice(0, 3);

  const automationActionEntries: Array<{
    action: CopilotAction;
    templateId: string;
    templateSource: "explicit_request" | "assistant_recommendation";
  }> = [];

  for (const templateId of recommendedTemplateIds) {
    const templateSource =
      templateId === matchedTemplateId && matchedTemplateSource
        ? matchedTemplateSource
        : ("assistant_recommendation" as const);
    const opportunity = await createOpportunityFromChatMatch(company.id, templateId, templateSource);
    if (!opportunity) continue;

    const capability = await getAutomationCapability(company.id, role, templateId, opportunity.id);
    const action = buildSafeAction(parsed.data.message, opportunity.id, templateId, capability);
    if (action) automationActionEntries.push({ action, templateId, templateSource });
  }

  const automationActions = automationActionEntries.map((entry) => entry.action);
  const fallbackAction =
    automationActions[0] ??
    buildSafeAction(parsed.data.message, null, null, null);
  const actions =
    automationActions.length > 0
      ? automationActions
      : fallbackAction
        ? [fallbackAction]
        : [];

  if (actions.length > 0) {
    await prisma.chatMessage.update({
      where: { id: assistantMessage.id },
      data: { actionsJson: JSON.stringify(actions) },
    });
  }

  if (automationActionEntries.length > 0) {
    for (const entry of automationActionEntries) {
      await track(EVENTS.RECOMMENDATION_SHOWN, {
        companyId: company.id,
        userId: session.user.id,
        metadata: {
          source: "copilot",
          actionKind: entry.action.kind,
          destination: entry.action.href,
          requiresConfirmation: Boolean(entry.action.requiresConfirmation),
          actorRole: role,
          templateId: entry.templateId,
          templateSource: entry.templateSource,
          automationReadiness: entry.action.automationReadiness ?? null,
        },
      });
    }
  } else if (fallbackAction) {
    await track(EVENTS.RECOMMENDATION_SHOWN, {
      companyId: company.id,
      userId: session.user.id,
      metadata: {
        source: "copilot",
        actionKind: fallbackAction.kind,
        destination: fallbackAction.href,
        requiresConfirmation: Boolean(fallbackAction.requiresConfirmation),
        actorRole: role,
        templateId: null,
        templateSource: null,
        automationReadiness: fallbackAction.automationReadiness ?? null,
      },
    });
  }

  return NextResponse.json({
    reply,
    action: fallbackAction,
    actions,
  });
}

async function createOpportunityFromChatMatch(
  companyId: string,
  templateId: string,
  source?: "explicit_request" | "assistant_recommendation"
) {
  const existing = await prisma.opportunity.findFirst({ where: { companyId, templateId } });
  if (existing?.status === "rejected" || existing?.status === "installed") return null;
  if (existing) return existing;

  const template = getTemplateById(templateId);
  if (!template) return null;

  const opportunity = await prisma.opportunity.create({
    data: {
      companyId,
      templateId: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      impactLevel: template.impactLevel,
      complexity: template.complexity,
      estimatedHoursPerMonth: template.estimatedHoursPerMonth,
      estimatedValueEur: Math.round(template.estimatedHoursPerMonth * HOURLY_RATE_EUR),
      priceEur: template.priceEur,
      status: "detected",
    },
  });

  await track(EVENTS.AUTOMATION_OPPORTUNITY_DETECTED, {
    companyId,
    metadata: {
      source: source === "assistant_recommendation" ? "copilot_recommendation" : "copilot_explicit_request",
      templateId,
    },
  });
  return opportunity;
}


async function getAutomationCapability(
  companyId: string,
  role: Parameters<typeof hasCompanyPermission>[0],
  templateId: string,
  opportunityId: string
) {
  if (!isRealExecutionTemplate(templateId)) {
    return { readiness: "not_executable" as const, blockers: ["workflow réel non disponible"] };
  }

  const blockers: string[] = [];
  if (!hasCompanyPermission(role, "configure_automations")) {
    blockers.push("validation d'un Propriétaire ou Administrateur");
  }

  const [entitlements, purchase] = await Promise.all([
    getCompanyEntitlements(companyId),
    prisma.purchase.findUnique({
      where: { companyId_opportunityId: { companyId, opportunityId } },
      select: { status: true },
    }),
  ]);
  if (!entitlements.canExecute) blockers.push("offre Action ou Scale requise");
  if (purchase?.status !== "paid") {
    const template = getTemplateById(templateId);
    blockers.push(
      hasCompanyPermission(role, "manage_billing")
        ? `achat unique de l'automatisation requis${template ? ` (${template.priceEur} € HT)` : ""}`
        : "achat de l'automatisation par le Propriétaire requis"
    );
  }
  if (!isN8nConfigured()) blockers.push("moteur d'exécution à configurer");

  return blockers.length === 0
    ? { readiness: "ready" as const, blockers }
    : { readiness: "configuration_required" as const, blockers };
}

function buildSafeAction(
  message: string,
  opportunityId: string | null,
  templateId?: string | null,
  capability?: {
    readiness: "ready" | "configuration_required" | "not_executable";
    blockers: string[];
  } | null
): CopilotAction | null {
  if (opportunityId) {
    const readiness = capability?.readiness ?? (templateId && isRealExecutionTemplate(templateId) ? "configuration_required" : "not_executable");
    const automatable = readiness !== "not_executable";
    const template = templateId ? getTemplateById(templateId) : null;
    return {
      kind: "navigate",
      label: automatable
        ? template
          ? `Automatiser : ${template.title}`
          : "Automatiser cette recommandation"
        : template
          ? `Préparer l'automatisation : ${template.title}`
          : "Préparer cette automatisation",
      href: `/app/opportunities/${opportunityId}`,
      description:
        readiness === "ready"
          ? "Pilotzia sait exécuter ce workflow. La page suivante affiche le prix d'achat unique, les destinataires, les permissions et la configuration avant toute activation."
          : readiness === "configuration_required"
            ? `Cette recommandation est automatisable après prérequis : ${capability?.blockers.join(" · ") || "configuration à compléter"}. Aucune activation n'est effectuée automatiquement.`
            : "Pilotzia a identifié une piste d'automatisation cohérente avec cette recommandation. Vous pouvez la préparer et l'évaluer, mais aucune exécution réelle ne sera proposée tant que le workflow ou le connecteur requis n'est pas disponible.",
      requiresConfirmation: automatable,
      automationReadiness: readiness,
    };
  }

  const normalized = message.toLowerCase();

  if (/connect|connexion|gmail|slack|notion|hubspot|calendar|calendrier|outil|application/.test(normalized)) {
    return {
      kind: "navigate",
      label: "Gérer les outils & connexions",
      href: "/app/tools",
      description: "Pilotzia distingue les outils simplement renseignés des connexions réellement autorisées.",
    };
  }

  if (/objectif|entreprise|activité|activite|contexte|mémoire|memoire|priorité|priorite/.test(normalized)) {
    return {
      kind: "navigate",
      label: "Mettre à jour la mémoire entreprise",
      href: "/app/company",
      description: "Ajoutez le contexte durable qui aide le copilote à mieux prioriser ses recommandations.",
    };
  }

  if (/automatis|opportunité|opportunite|gagner du temps|perdre du temps/.test(normalized)) {
    return {
      kind: "navigate",
      label: "Voir les opportunités",
      href: "/app/opportunities",
      description: "Consultez les recommandations déjà détectées et leur impact estimé.",
    };
  }

  return null;
}
