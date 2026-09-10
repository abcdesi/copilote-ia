import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { buildChatContext } from "@/lib/companies/context";
import { runChat } from "@/lib/ai";

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
  const reply = await runChat(
    history
      .slice()
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    context
  );

  await prisma.chatMessage.create({
    data: { companyId: company.id, role: "assistant", content: reply },
  });

  return NextResponse.json({ reply });
}
