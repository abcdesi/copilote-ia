import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/companies/current";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return NextResponse.json({ error: "Aucune entreprise associée." }, { status: 404 });

  const automation = await prisma.automation.findFirst({ where: { id, companyId: company.id } });
  if (!automation) return NextResponse.json({ error: "Automatisation introuvable." }, { status: 404 });

  const reactivating = automation.status === "inactive";

  const updated = await prisma.automation.update({
    where: { id: automation.id },
    data: reactivating
      ? { status: "active", health: "green", lastModifiedAt: new Date() }
      : { status: "inactive", lastModifiedAt: new Date() },
  });

  await track(reactivating ? EVENTS.AUTOMATION_REACTIVATED : EVENTS.AUTOMATION_DEACTIVATED, {
    companyId: company.id,
    metadata: { automationId: automation.id },
  });

  return NextResponse.json({ status: updated.status });
}
