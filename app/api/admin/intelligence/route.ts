import { NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { buildAdminIntelligenceSummary } from "@/lib/admin/intelligence";

export async function GET() {
  const session = await requireSession();
  if (!isPilotziaAdmin(session.user.email)) {
    return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  }

  return NextResponse.json(await buildAdminIntelligenceSummary());
}
