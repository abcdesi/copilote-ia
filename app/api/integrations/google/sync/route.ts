import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { syncGoogleOperationalSnapshot } from "@/lib/integrations/observe";

function syncFailureCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/reconnecté|Rafraîchissement Google|Google API 401/i.test(message)) return "reauth-required";
  if (/Google API 403/i.test(message)) return "scope-or-api-error";
  if (/ENCRYPTION_KEY/i.test(message)) return "secure-storage-error";
  return "sync-error";
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireCompanyPermission("sync_integrations");
    const snapshot = await syncGoogleOperationalSnapshot(access.company.id, access.session.user.id, "manual");
    if (req.headers.get("accept")?.includes("application/json")) return NextResponse.json({ snapshot });
    return NextResponse.redirect(new URL("/app/tools?google=synced", req.nextUrl.origin), 303);
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      if (req.headers.get("accept")?.includes("application/json")) {
        return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/app/tools?google=permission-denied", req.nextUrl.origin), 303);
    }

    console.error("Google sync failed", error);
    const code = syncFailureCode(error);
    try {
      const access = await requireCompanyPermission("view");
      await prisma.integrationConnection.updateMany({
        where: { companyId: access.company.id, provider: "google" },
        data: { lastError: error instanceof Error ? error.message.slice(0, 500) : "Erreur de synchronisation" },
      });
    } catch {
      // L'erreur initiale reste la source de vérité ; ne pas masquer un échec de sync.
    }

    if (req.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ error: "Synchronisation impossible.", code }, { status: 502 });
    }
    return NextResponse.redirect(new URL(`/app/tools?google=${code}`, req.nextUrl.origin), 303);
  }
}
