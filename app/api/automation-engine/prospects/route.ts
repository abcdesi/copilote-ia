import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyN8nCallback } from "@/lib/n8n/callback-auth";

// Appelé par le workflow n8n "Relance automatique des prospects" : renvoie les
// prospects actifs jamais relancés ou pas relancés depuis 7 jours ou plus.
export async function GET(req: NextRequest) {
  if (!verifyN8nCallback(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId requis." }, { status: 400 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const prospects = await prisma.prospect.findMany({
    where: {
      companyId,
      status: "active",
      OR: [{ lastContactedAt: null }, { lastContactedAt: { lte: sevenDaysAgo } }],
    },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ prospects });
}
