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

const bodySchema = z.object({ message: z.string().min(1).max(1000) });

export interface CopilotAction {
  kind: "navigate";
  label: string;
  href: string;
  description?: string;
  requiresConfirmation?: boolean;
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
  const { reply, matchedTemplateId } = await runChat(
    history
      .slice()
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    context
  );

  await prisma.chatMessage.create({
    data: { companyId: company.id, conversationId: conversation.id, role: "assistant", content: reply },
  });

  const opportunity = matchedTemplateId
    ? await createOpportunityFromChatMatch(company.id, matchedTemplateId)
    : null;

  const action = buildSafeAction(parsed.data.message, opportunity?.id ?? null);

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
