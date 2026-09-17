import { NextRequest, NextResponse } from "next/server";
import { getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { exchangeGoogleCode, upsertGoogleConnection, verifyGoogleState } from "@/lib/integrations/google";
import { syncGoogleOperationalSnapshot } from "@/lib/integrations/observe";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function callbackErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/ENCRYPTION_KEY/i.test(message)) return "secure-storage-error";
  if (/Échange OAuth Google/i.test(message)) return "token-error";
  if (/État OAuth|Signature OAuth/i.test(message)) return "state-error";
  if (/Profil Google/i.test(message)) return "profile-error";
  return "callback-error";
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError) {
    const status = oauthError === "access_denied" ? "cancelled" : "provider-error";
    return NextResponse.redirect(`${appUrl()}/app/tools?google=${status}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl()}/app/tools?google=invalid-response`);
  }

  try {
    const access = await getCurrentCompanyAccess();
    if (!hasCompanyPermission(access.role, "manage_integrations")) {
      return NextResponse.redirect(`${appUrl()}/app/tools?google=permission-denied`);
    }

    const verified = verifyGoogleState(state);
    if (verified.companyId !== access.company.id) {
      return NextResponse.redirect(`${appUrl()}/app/tools?google=forbidden`);
    }

    const tokens = await exchangeGoogleCode(code);
    await upsertGoogleConnection(access.company.id, tokens);
    await prisma.$transaction([
      prisma.companyTool.upsert({
        where: { companyId_name: { companyId: access.company.id, name: "Gmail" } },
        create: { companyId: access.company.id, name: "Gmail", detected: true },
        update: {},
      }),
      prisma.companyTool.upsert({
        where: { companyId_name: { companyId: access.company.id, name: "Google Calendar" } },
        create: { companyId: access.company.id, name: "Google Calendar", detected: true },
        update: {},
      }),
      prisma.event.create({
        data: {
          userId: access.session.user.id,
          companyId: access.company.id,
          type: "INTEGRATION_CONNECTED",
          metadata: JSON.stringify({ provider: "google", authorizationMode: verified.mode }),
        },
      }),
    ]);

    try {
      await syncGoogleOperationalSnapshot(access.company.id, access.session.user.id, "oauth_callback");
      return NextResponse.redirect(`${appUrl()}/app/tools?google=${verified.mode === "action" ? "actions-authorized" : "connected"}`);
    } catch (syncError) {
      console.error("Google first sync failed after OAuth", syncError);
      return NextResponse.redirect(`${appUrl()}/app/tools?google=connected-sync-error`);
    }
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    return NextResponse.redirect(`${appUrl()}/app/tools?google=${callbackErrorCode(error)}`);
  }
}
