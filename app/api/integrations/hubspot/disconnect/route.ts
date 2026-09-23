import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { decrypt } from "@/lib/crypto/encryption";
import { revokeHubSpotRefreshToken } from "@/lib/integrations/hubspot";

export async function POST(req: NextRequest) {
  try {
    const access = await requireCompanyPermission("manage_integrations");
    const connection = await prisma.integrationConnection.findUnique({
      where: { companyId_provider: { companyId: access.company.id, provider: "hubspot" } },
    });

    let remoteRevoked = false;
    if (connection && connection.status !== "disconnected") {
      if (connection.refreshTokenEncrypted && connection.refreshTokenEncrypted !== "revoked") {
        try {
          remoteRevoked = await revokeHubSpotRefreshToken(decrypt(connection.refreshTokenEncrypted));
        } catch (error) {
          console.error("HubSpot remote revocation failed", error);
        }
      }

      await prisma.$transaction([
        prisma.integrationConnection.update({
          where: { id: connection.id },
          data: {
            status: "disconnected",
            accessTokenEncrypted: "revoked",
            refreshTokenEncrypted: null,
            expiresAt: null,
            lastError: remoteRevoked ? null : "Révocation distante non confirmée ; accès local supprimé.",
          },
        }),
        prisma.event.create({
          data: {
            userId: access.session.user.id,
            companyId: access.company.id,
            type: "INTEGRATION_DISCONNECTED",
            metadata: JSON.stringify({ provider: "hubspot", remoteRevoked }),
          },
        }),
      ]);
    }

    return NextResponse.redirect(new URL("/app/tools?hubspot=disconnected", req.nextUrl.origin), 303);
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.redirect(new URL("/app/tools?hubspot=permission-denied", req.nextUrl.origin), 303);
    }
    console.error("HubSpot disconnect failed", error);
    return NextResponse.redirect(new URL("/app/tools?hubspot=disconnect-error", req.nextUrl.origin), 303);
  }
}
