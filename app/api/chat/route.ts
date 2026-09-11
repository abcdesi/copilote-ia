import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { buildChatContext } from "@/lib/companies/context";
import { runChat } from "@/lib/ai";
import { getTemplateById } from "@/lib/automations/catalog";
import { HOURLY_RATE_EUR } from "@/lib/automations/types";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

const bodySchema = z.object({ message: z.string().min(1).max(1000) });

export async function POST(req: NextRequest) {
  const session = await requireSession();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Message invalide." }, { status: 400 });
  }

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return NextResponse.json({ error: "Aucune entreprise associée." }, { status: 404 });

  await prisma.chatMessage.create({
    data: { companyId: company.id, role: "user", content: parsed.data.message },
  });

  const history = await prisma.chatMessage.findMany({
    where: { companyId: company.id },
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
    data: { companyId: company.id, role: "assistant", content: reply },
  });

  if (matchedTemplateId) {
    await createOpportunityFromChatMatch(company.id, matchedTemplateId);
  }

  return NextResponse.json({ reply });
}

async function createOpportunityFromChatMatch(companyId: string, templateId: string) {
  const existing = await prisma.opportunity.findFirst({ where: { companyId, templateId } });
  if (existing) return;

  const template = getTemplateById(templateId);
  if (!template) return;

  await prisma.opportunity.create({
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
}
