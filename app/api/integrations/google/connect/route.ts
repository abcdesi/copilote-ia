import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { buildGoogleAuthorizationUrl, getGoogleConfigurationStatus } from "@/lib/integrations/google";

export async function GET(req: NextRequest) {
  try {
    const access = await requireCompanyPermission("manage_integrations");
    const configuration = getGoogleConfigurationStatus();
    if (!configuration.configured) {
      console.error("Google integration configuration incomplete", configuration.missing);
      return NextResponse.redirect(new URL("/app/tools?google=config-error", req.nextUrl.origin));
    }

    const mode = req.nextUrl.searchParams.get("mode") === "action" ? "action" : "observe";
    return NextResponse.redirect(buildGoogleAuthorizationUrl(access.company.id, mode));
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.redirect(new URL("/app/tools?google=permission-denied", req.nextUrl.origin));
    }
    console.error("Google OAuth start failed", error);
    return NextResponse.redirect(new URL("/app/tools?google=start-error", req.nextUrl.origin));
  }
}
