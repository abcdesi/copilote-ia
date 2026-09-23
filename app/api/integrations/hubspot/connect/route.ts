import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { buildHubSpotAuthorizationUrl, getHubSpotConfigurationStatus } from "@/lib/integrations/hubspot";

export async function GET(req: NextRequest) {
  try {
    const access = await requireCompanyPermission("manage_integrations");
    const configuration = getHubSpotConfigurationStatus();
    if (!configuration.configured) {
      console.error("HubSpot integration configuration incomplete", configuration.missing);
      return NextResponse.redirect(new URL("/app/tools?hubspot=config-error", req.nextUrl.origin));
    }
    return NextResponse.redirect(buildHubSpotAuthorizationUrl(access.company.id));
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.redirect(new URL("/app/tools?hubspot=permission-denied", req.nextUrl.origin));
    }
    console.error("HubSpot OAuth start failed", error);
    return NextResponse.redirect(new URL("/app/tools?hubspot=start-error", req.nextUrl.origin));
  }
}
