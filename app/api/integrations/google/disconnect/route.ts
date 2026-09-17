import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { decrypt } from "@/lib/crypto/encryption";

const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export async function POST(req: NextRequest) {
  try {
    const access = await requireCompanyPermission("manage_integrations");
    const connection = await prisma.integrationConnection.findUnique({
      where: { companyId_provider: { companyId: access.company.id, provider: "google" } },
    });

    let remoteRevoked = false;
    if (connection && connection.status !== "disconnected") {
      try {
        const encrypted = connection.refreshTokenEncrypted || connection.accessTokenEncrypted;
        if (encrypted && encrypted !== "revoked") {
          const token = decrypt(encrypted);
          const revoke = await fetch(GOOGLE_REVOKE_URL, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token }),
          });
          remoteRevoked = revoke.ok;
        }
      } catch (error) {
        console.error("Google remote revocation failed", error);
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
            metadata: JSON.stringify({ provider: "google", remoteRevoked }),
          },
        }),
      ]);
    }

    return NextResponse.redirect(new URL("/app/tools?google=disconnected", req.nextUrl.origin), 303);
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.redirect(new URL("/app/tools?google=permission-denied", req.nextUrl.origin), 303);
    }
    console.error("Google disconnect failed", error);
    return NextResponse.redirect(new URL("/app/tools?google=disconnect-error", req.nextUrl.origin), 303);
  }
}
