import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { buildChatContext } from "@/lib/companies/context";
import { getOrCreateTodayConversation } from "@/lib/companies/conversations";
import { runChat } from "@/lib/ai";
import { getTemplateById } from "@/lib/automations/catalog";
import { HOURLY_RATE_EUR } from "@/lib/automations/types";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { AI_USAGE_RESERVE_EUR, reserveUsage } from "@/lib/billing/usage-policy";

const bodySchema = z.object({ message: z.string().min(1).max(1000) });

export interface CopilotAction {
  kind: "navigate";
  label: string;
  href: string;
  description?: string;
  requiresConfirmation?: boolean;
}

function isSmartRequest(message: string) {
  return (
    message.length > 420 ||
    /analyse|stratég|strategie|plan|compare|diagnostic|priorit|pourquoi|optimis|audit|finance|financier|bilan|compte de résultat|compte de resultat|marge|trésorerie|tresorerie|rentabil|gagner du temps|perdre du temps|délai de réponse|delai de reponse|objectif|direction|conseil/i.test(
      message
    )
  );
}

export async function POST(req: NextRequest) {
  const session = await requireSession();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return NextResponse.json({ error: "Aucune entreprise associée." }, { status: 404 });

  const conversation = await getOrCreateTodayConversation(company.id);

  await prisma.chatMessage.create({
    data: { companyId: company.id, conversationId: conversation.id, role: "user", content: parsed.data.message },
  });

  const history = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const context = await buildChatContext(company.id);
  const smart = isSmartRequest(parsed.data.message);
  const usage = process.env.ANTHROPIC_API_KEY
    ? await reserveUsage({
        companyId: company.id,
        kind: smart ? "ai_smart" : "ai_fast",
        credits: smart ? 3 : 1,
        reservedCostEur: smart ? AI_USAGE_RESERVE_EUR.smart : AI_USAGE_RESERVE_EUR.fast,
      })
    : { allowed: true as const, paid: false as const, reservationId: null };

  if (!usage.allowed) {
    const isPaidLimit = usage.reason === "plan_credits_exhausted" || usage.reason === "plan_cost_cap_reached";
    const reply = isPaidLimit
      ? "Votre enveloppe mensuelle d'usage intelligent est arrivée à sa limite. Pilotzia conserve tout votre contexte et votre historique. Vous pouvez passer à l'offre supérieure pour continuer immédiatement avec davantage de capacité."
      : "Votre essai Pilotzia est arrivé à sa limite. Votre contexte, vos connexions et votre historique restent conservés. Activez un abonnement pour reprendre les analyses IA sans repartir de zéro.";

    await prisma.chatMessage.create({
      data: { companyId: company.id, conversationId: conversation.id, role: "assistant", content: reply },
    });
    await track(EVENTS.RECOMMENDATION_SHOWN, {
      companyId: company.id,
      metadata: { source: "usage_limit", reason: usage.reason },
    });
    return NextResponse.json({
      reply,
      action: {
        kind: "navigate",
        label: isPaidLimit ? "Augmenter ma capacité" : "Voir les offres Pilotzia",
        href: "/app/settings",
        description: isPaidLimit
          ? "Comparez les capacités mensuelles et les fonctions débloquées par chaque offre."
          : "Votre contexte reste intact. L'abonnement réactive le copilote et l'usage continu.",
      } satisfies CopilotAction,
      usageLimited: true,
      usageReason: usage.reason,
    });
  }

  const { reply, matchedTemplateId } = await runChat(
    history
      .slice()
      .reverse()
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
    context
  );

  await prisma.chatMessage.create({
    data: { companyId: company.id, conversationId: conversation.id, role: "assistant", content: reply },
  });

  const opportunity = matchedTemplateId
    ? await createOpportunityFromChatMatch(company.id, matchedTemplateId)
    : null;

  const action = buildSafeAction(parsed.data.message, opportunity?.id ?? null);

  if (action) {
    await track(EVENTS.RECOMMENDATION_SHOWN, {
      companyId: company.id,
      metadata: {
        source: "copilot",
        actionKind: action.kind,
        destination: action.href,
        requiresConfirmation: Boolean(action.requiresConfirmation),
      },
    });
  }

  return NextResponse.json({ reply, action });
}

async function createOpportunityFromChatMatch(companyId: string, templateId: string) {
  const existing = await prisma.opportunity.findFirst({ where: { companyId, templateId } });
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

  await track(EVENTS.AUTOMATION_OPPORTUNITY_DETECTED, { companyId, metadata: { source: "chat", templateId } });
  return opportunity;
}

function buildSafeAction(message: string, opportunityId: string | null): CopilotAction | null {
  if (opportunityId) {
    return {
      kind: "navigate",
      label: "Voir la recommandation",
      href: `/app/opportunities/${opportunityId}`,
      description: "Vérifiez le fonctionnement, l'impact estimé et les étapes avant toute activation.",
      requiresConfirmation: true,
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
