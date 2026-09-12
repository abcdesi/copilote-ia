import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { syncGoogleOperationalSnapshot } from "@/lib/integrations/observe";

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const company = await prisma.company.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });

  try {
    const snapshot = await syncGoogleOperationalSnapshot(company.id);
    if (req.headers.get("accept")?.includes("application/json")) return NextResponse.json({ snapshot });
    return NextResponse.redirect(new URL("/app/tools?google=synced", req.nextUrl.origin), 303);
  } catch (error) {
    console.error("Google sync failed", error);
    await prisma.integrationConnection.updateMany({
      where: { companyId: company.id, provider: "google" },
      data: { status: "error", lastError: error instanceof Error ? error.message.slice(0, 500) : "Erreur de synchronisation" },
    });
    if (req.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ error: "Synchronisation impossible." }, { status: 502 });
    }
    return NextResponse.redirect(new URL("/app/tools?google=sync-error", req.nextUrl.origin), 303);
  }
}
