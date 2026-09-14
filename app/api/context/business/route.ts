import { NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { getBusinessGraphContext } from "@/lib/business-graph";
import { getEntityResolutionSummary } from "@/lib/business-graph/entity-resolution";

export async function GET() {
  const session = await requireSession();
  const company = await prisma.company.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Aucune entreprise associée." }, { status: 404 });

  const [context, identityResolution] = await Promise.all([
    getBusinessGraphContext(company.id),
    getEntityResolutionSummary(company.id),
  ]);

  return NextResponse.json({
    version: "2026-09-14.2",
    companyId: company.id,
    identityResolution,
    ...context,
  });
}
