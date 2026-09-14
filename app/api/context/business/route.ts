import { NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { getBusinessGraphContext } from "@/lib/business-graph";

export async function GET() {
  const session = await requireSession();
  const company = await prisma.company.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Aucune entreprise associée." }, { status: 404 });

  const context = await getBusinessGraphContext(company.id);
  return NextResponse.json({
    version: "2026-09-14",
    companyId: company.id,
    ...context,
  });
}
