import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  try {
    const access = await requireCompanyPermission("manage_integrations");
    const connection = await prisma.integrationConnection.findUnique({
      where: { companyId_provider: { companyId: access.company.id, provider: "stripe_business" } },
    });

    if (connection) {
      await prisma.$transaction([
        prisma.integrationConnection.update({
          where: { id: connection.id },
          data: {
            status: "disconnected",
            accessTokenEncrypted: "revoked",
            lastError: null,
          },
        }),
        prisma.event.create({
          data: {
            userId: access.session.user.id,
            companyId: access.company.id,
            type: "INTEGRATION_DISCONNECTED",
            metadata: JSON.stringify({ provider: "stripe_business" }),
          },
        }),
      ]);
    }

    return NextResponse.redirect(new URL("/app/tools?stripeBusiness=disconnected", req.nextUrl.origin), 303);
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.redirect(new URL("/app/tools?stripeBusiness=permission-denied", req.nextUrl.origin), 303);
    }
    console.error("Stripe business disconnect failed", error);
    return NextResponse.redirect(new URL("/app/tools?stripeBusiness=disconnect-error", req.nextUrl.origin), 303);
  }
}
