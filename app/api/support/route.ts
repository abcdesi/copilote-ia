import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentCompanyAccess } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { getUsageStatus } from "@/lib/billing/usage-policy";
import { notifySupportTeam } from "@/lib/support/notify";

const schema = z.object({
  category: z.enum(["billing", "technical", "data", "privacy", "automation", "feature", "other"]),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(5000),
});

function inferPriority(category: string, subject: string, message: string) {
  const text = `${subject} ${message}`.toLowerCase();
  if (/paiement|payment|factur|débit|debit|double|rembourse|bloqu|indisponible|erreur critique|perte de données|perte de donnees/.test(text)) return "high";
  if (category === "billing" || category === "technical") return "normal";
  return "low";
}

function requestHash(category: string, subject: string, message: string) {
  return createHash("sha256").update(`${category}|${subject}|${message}`).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  const access = await getCurrentCompanyAccess();
  const parsed = schema.safeParse(Object.fromEntries((await req.formData()).entries()));
  if (!parsed.success) return NextResponse.json({ error: "Demande d'assistance invalide." }, { status: 400 });
  if (!access.session.user.email) return NextResponse.json({ error: "Compte incomplet." }, { status: 400 });

  const now = Date.now();
  const hash = requestHash(parsed.data.category, parsed.data.subject, parsed.data.message);
  const usage = await getUsageStatus(access.company.id).catch(() => null);
  const priority = inferPriority(parsed.data.category, parsed.data.subject, parsed.data.message);

  const created = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Company" WHERE id = ${access.company.id} FOR UPDATE`;

    const [hourlyCount, dailyCount, duplicate] = await Promise.all([
      tx.event.count({
        where: {
          companyId: access.company.id,
          userId: access.session.user.id,
          type: "SUPPORT_REQUEST_CREATED",
          createdAt: { gte: new Date(now - 60 * 60 * 1000) },
        },
      }),
      tx.event.count({
        where: {
          companyId: access.company.id,
          userId: access.session.user.id,
          type: "SUPPORT_REQUEST_CREATED",
          createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) },
        },
      }),
      tx.event.findFirst({
        where: {
          companyId: access.company.id,
          userId: access.session.user.id,
          type: `SUPPORT_DUPLICATE_${hash}`,
          createdAt: { gte: new Date(now - 5 * 60 * 1000) },
        },
        select: { id: true },
      }),
    ]);

    if (hourlyCount >= 5 || dailyCount >= 20) return { limited: true as const };
    if (duplicate) return { duplicate: true as const };

    const ticket = await tx.supportRequest.create({
      data: {
        companyId: access.company.id,
        requesterEmail: access.session.user.email!,
        category: parsed.data.category,
        subject: parsed.data.subject,
        message: parsed.data.message,
        priority,
        contextJson: JSON.stringify({
          requesterUserId: access.session.user.id,
          requesterName: access.session.user.name ?? null,
          requesterRole: access.role,
          plan: usage?.plan ?? null,
          planLabel: usage?.planLabel ?? null,
          creditsUsed: usage?.creditsUsed ?? null,
          creditsLimit: usage?.creditsLimit ?? null,
          alertLevel: usage?.alertLevel ?? null,
          periodEndsAt: usage?.periodEndsAt?.toISOString() ?? null,
        }),
      },
    });

    await tx.event.createMany({
      data: [
        {
          companyId: access.company.id,
          userId: access.session.user.id,
          type: "SUPPORT_REQUEST_CREATED",
          metadata: JSON.stringify({ ticketId: ticket.id, priority, category: ticket.category, actorRole: access.role }),
        },
        {
          companyId: access.company.id,
          userId: access.session.user.id,
          type: `SUPPORT_DUPLICATE_${hash}`,
          metadata: ticket.id,
        },
      ],
    });

    return { ticket };
  }, { timeout: 10_000 });

  if ("limited" in created) {
    return NextResponse.json(
      { error: "Trop de demandes ont été envoyées récemment. Consultez vos tickets existants ou réessayez plus tard." },
      { status: 429 }
    );
  }
  if ("duplicate" in created) {
    return NextResponse.redirect(new URL("/app/support?sent=1", req.url), 303);
  }
  const ticket = created.ticket;
  await notifySupportTeam({
    ticketId: ticket.id,
    companyName: access.company.name,
    requesterEmail: access.session.user.email,
    category: ticket.category,
    subject: ticket.subject,
    message: ticket.message,
    priority: ticket.priority,
  }).catch((error) => console.error("Support notification unavailable", error));

  return NextResponse.redirect(new URL("/app/support?sent=1", req.url), 303);
}
