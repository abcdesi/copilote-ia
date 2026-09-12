import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { exchangeGoogleCode, upsertGoogleConnection, verifyGoogleState } from "@/lib/integrations/google";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError || !code || !state) {
    return NextResponse.redirect(`${appUrl()}/app/tools?google=cancelled`);
  }

  try {
    const verified = verifyGoogleState(state);
    const company = await prisma.company.findFirst({
      where: { id: verified.companyId, userId: session.user.id },
      select: { id: true },
    });
    if (!company) return NextResponse.redirect(`${appUrl()}/app/tools?google=forbidden`);

    const tokens = await exchangeGoogleCode(code);
    await upsertGoogleConnection(company.id, tokens);
    await prisma.companyTool.upsert({
      where: { companyId_name: { companyId: company.id, name: "Gmail" } },
      create: { companyId: company.id, name: "Gmail", detected: true },
      update: {},
    });
    await prisma.companyTool.upsert({
      where: { companyId_name: { companyId: company.id, name: "Google Calendar" } },
      create: { companyId: company.id, name: "Google Calendar", detected: true },
      update: {},
    });
    return NextResponse.redirect(`${appUrl()}/app/tools?google=connected`);
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    return NextResponse.redirect(`${appUrl()}/app/tools?google=error`);
  }
}
