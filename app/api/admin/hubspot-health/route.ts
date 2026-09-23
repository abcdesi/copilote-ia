import { NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { getHubSpotConfigurationStatus, hubspotRedirectUri, HUBSPOT_SCOPES } from "@/lib/integrations/hubspot";

export async function GET() {
  const session = await requireSession();
  if (!isPilotziaAdmin(session.user.email)) {
    return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  }

  const configuration = getHubSpotConfigurationStatus();
  let redirectUri: string | null = null;
  if (process.env.APP_URL) {
    try {
      redirectUri = hubspotRedirectUri();
    } catch {
      redirectUri = null;
    }
  }

  return NextResponse.json({
    provider: "hubspot",
    configured: configuration.configured,
    missing: configuration.missing,
    redirectUri,
    scopes: HUBSPOT_SCOPES,
    permissionMode: "read_only",
  });
}
