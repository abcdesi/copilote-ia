import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { getUsageStatus } from "@/lib/billing/usage-policy";
import { notifySupportTeam } from "@/lib/support/notify";

const schema = z.object({
  category: z.enum(["billing", "technical", "data", "automation", "feature", "other"]),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(5000),
});

function inferPriority(category: string, subject: string, message: string) {
  const text = `${subject} ${message}`.toLowerCase();
  if (/paiement|payment|factur|débit|debit|double|rembourse|bloqu|indisponible|erreur critique|perte de données|perte de donnees/.test(text)) return "high";
  if (category === "billing" || category === "technical") return "normal";
  return "low";
}

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const parsed = schema.safeParse(Object.fromEntries((await req.formData()).entries()));
  if (!parsed.success) return NextResponse.json({ error: "Demande d'assistance invalide." }, { status: 400 });

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company || !session.user.email) return NextResponse.json({ error: "Compte incomplet." }, { status: 400 });

  const usage = await getUsageStatus(company.id).catch(() => null);
  const priority = inferPriority(parsed.data.category, parsed.data.subject, parsed.data.message);
  const ticket = await prisma.supportRequest.create({
    data: {
      companyId: company.id,
      requesterEmail: session.user.email,
      category: parsed.data.category,
      subject: parsed.data.subject,
      message: parsed.data.message,
      priority,
      contextJson: JSON.stringify({
        plan: usage?.plan ?? null,
        planLabel: usage?.planLabel ?? null,
        creditsUsed: usage?.creditsUsed ?? null,
        creditsLimit: usage?.creditsLimit ?? null,
        alertLevel: usage?.alertLevel ?? null,
        periodEndsAt: usage?.periodEndsAt?.toISOString() ?? null,
      }),
    },
  });

  await notifySupportTeam({
    ticketId: ticket.id,
    companyName: company.name,
    requesterEmail: session.user.email,
    category: ticket.category,
    subject: ticket.subject,
    message: ticket.message,
    priority: ticket.priority,
  }).catch((error) => console.error("Support notification unavailable", error));

  return NextResponse.redirect(new URL("/app/support?sent=1", req.url), 303);
}
