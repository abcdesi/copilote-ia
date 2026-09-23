import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { syncHubSpotOperationalSnapshot } from "@/lib/integrations/hubspot-observe";

export async function POST(req: NextRequest) {
  try {
    const access = await requireCompanyPermission("sync_integrations");
    const snapshot = await syncHubSpotOperationalSnapshot(access.company.id, access.session.user.id, "manual");
    if (req.headers.get("accept")?.includes("application/json")) return NextResponse.json({ snapshot });
    return NextResponse.redirect(new URL("/app/tools?hubspot=synced", req.nextUrl.origin), 303);
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    }
    console.error("HubSpot sync failed", error);
    try {
      const access = await requireCompanyPermission("view");
      await prisma.integrationConnection.updateMany({
        where: { companyId: access.company.id, provider: "hubspot" },
        data: {
          lastError: error instanceof Error ? error.message.slice(0, 500) : "Erreur de synchronisation HubSpot",
        },
      });
    } catch {}
    if (req.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ error: "Synchronisation HubSpot impossible." }, { status: 502 });
    }
    return NextResponse.redirect(new URL("/app/tools?hubspot=sync-error", req.nextUrl.origin), 303);
  }
}
