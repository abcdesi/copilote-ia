import { NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { getGoogleConfigurationStatus, googleRedirectUri } from "@/lib/integrations/google";

export async function GET() {
  const session = await requireSession();
  if (!isPilotziaAdmin(session.user.email)) {
    return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });
  }

  const configuration = getGoogleConfigurationStatus();
  let redirectUri: string | null = null;
  if (process.env.APP_URL) {
    try {
      redirectUri = googleRedirectUri();
    } catch {
      redirectUri = null;
    }
  }

  return NextResponse.json({
    provider: "google",
    configured: configuration.configured,
    missing: configuration.missing,
    redirectUri,
  });
}
