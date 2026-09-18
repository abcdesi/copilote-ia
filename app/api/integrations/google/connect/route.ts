import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { buildGoogleAuthorizationUrl, getGoogleConfigurationStatus } from "@/lib/integrations/google";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const company = await prisma.company.findFirst({ where: { userId: session.user.id }, select: { id: true } });
    if (!company) return NextResponse.redirect(new URL("/app/tools?google=company-error", req.nextUrl.origin));

    const configuration = getGoogleConfigurationStatus();
    if (!configuration.configured) {
      console.error("Google integration configuration incomplete", configuration.missing);
      return NextResponse.redirect(new URL("/app/tools?google=config-error", req.nextUrl.origin));
    }

    return NextResponse.redirect(buildGoogleAuthorizationUrl(company.id));
  } catch (error) {
    console.error("Google OAuth start failed", error);
    return NextResponse.redirect(new URL("/app/tools?google=start-error", req.nextUrl.origin));
  }
}
