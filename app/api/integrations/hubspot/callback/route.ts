import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { exchangeHubSpotCode, upsertHubSpotConnection, verifyHubSpotState } from "@/lib/integrations/hubspot";
import { ensureProviderOutcomeRelayWorkflow } from "@/lib/n8n/provider-outcome-workflows";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/ENCRYPTION_KEY/i.test(message)) return "secure-storage-error";
  if (/Échange OAuth HubSpot/i.test(message)) return "token-error";
  if (/État OAuth HubSpot|Signature OAuth HubSpot/i.test(message)) return "state-error";
  if (/Compte HubSpot|identifiant du portail/i.test(message)) return "account-error";
  return "callback-error";
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${appUrl()}/app/tools?hubspot=${oauthError === "access_denied" ? "cancelled" : "provider-error"}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl()}/app/tools?hubspot=invalid-response`);
  }

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
    await ensureProviderOutcomeRelayWorkflow("hubspot");
    const connection = await upsertHubSpotConnection(access.company.id, tokens);

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
          metadata: JSON.stringify({
            provider: "hubspot",
            externalAccountId: connection.externalAccountId,
            mode: "read_only",
          }),
        },
      }),
    ]);

    return NextResponse.redirect(`${appUrl()}/app/tools?hubspot=connected`);
  } catch (error) {
    console.error("HubSpot OAuth callback failed", error);
    return NextResponse.redirect(`${appUrl()}/app/tools?hubspot=${errorCode(error)}`);
  }
}
