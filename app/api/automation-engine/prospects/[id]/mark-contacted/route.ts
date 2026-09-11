import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyN8nCallback } from "@/lib/n8n/callback-auth";

// Appelé par le workflow n8n après l'envoi réel d'un email, pour que le contact ne soit
// pas recontacté avant le prochain délai (ou plus jamais, selon l'automatisation).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyN8nCallback(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;

  const prospect = await prisma.prospect.update({
    where: { id },
    data: { lastContactedAt: new Date() },
  });

  await incrementAutomationUsage(prospect.companyId, prospect.templateId);

  return NextResponse.json({ ok: true });
}

async function incrementAutomationUsage(companyId: string, templateId: string) {
  const automation = await prisma.automation.findFirst({ where: { companyId, templateId } });
  if (!automation) return;

  await prisma.automation.update({
    where: { id: automation.id },
    data: { usageCount: { increment: 1 }, lastCheckedAt: new Date() },
  });
}
