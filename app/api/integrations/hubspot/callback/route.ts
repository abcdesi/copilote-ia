import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { exchangeHubSpotCode, upsertHubSpotConnection, verifyHubSpotState } from "@/lib/integrations/hubspot";
import { syncHubSpotOperationalSnapshot } from "@/lib/integrations/hubspot-observe";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/ENCRYPTION_KEY/i.test(message)) return "secure-storage-error";
  if (/Échange OAuth HubSpot/i.test(message)) return "token-error";
  if (/État OAuth HubSpot|Signature OAuth HubSpot/i.test(message)) return "state-error";
  if (/HubSpot API 403/i.test(message)) return "scope-error";
  return "callback-error";
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(`${appUrl()}/app/tools?hubspot=${oauthError === "access_denied" ? "cancelled" : "provider-error"}`);
  }
  if (!code || !state) return NextResponse.redirect(`${appUrl()}/app/tools?hubspot=invalid-response`);

  try {
    const access = await getCurrentCompanyAccess();
    if (!hasCompanyPermission(access.role, "manage_integrations")) {
      return NextResponse.redirect(`${appUrl()}/app/tools?hubspot=permission-denied`);
    }

    const verified = verifyHubSpotState(state);
    if (verified.companyId !== access.company.id) {
      return NextResponse.redirect(`${appUrl()}/app/tools?hubspot=forbidden`);
    }

    const tokens = await exchangeHubSpotCode(code);
    await upsertHubSpotConnection(access.company.id, tokens);
    await prisma.$transaction([
      prisma.companyTool.upsert({
        where: { companyId_name: { companyId: access.company.id, name: "HubSpot" } },
        create: { companyId: access.company.id, name: "HubSpot", detected: false },
        update: {},
      }),
      prisma.event.create({
        data: {
          userId: access.session.user.id,
          companyId: access.company.id,
          type: "INTEGRATION_CONNECTED",
          metadata: JSON.stringify({ provider: "hubspot", permissionMode: "read_only" }),
        },
      }),
    ]);

    try {
      await syncHubSpotOperationalSnapshot(access.company.id, access.session.user.id, "oauth_callback");
      return NextResponse.redirect(`${appUrl()}/app/tools?hubspot=connected`);
    } catch (syncError) {
      console.error("HubSpot first sync failed after OAuth", syncError);
      return NextResponse.redirect(`${appUrl()}/app/tools?hubspot=connected-sync-error`);
    }
  } catch (error) {
    console.error("HubSpot OAuth callback failed", error);
    return NextResponse.redirect(`${appUrl()}/app/tools?hubspot=${errorCode(error)}`);
  }
}
