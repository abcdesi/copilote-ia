import { NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST() {
  const session = await requireSession();
  const company = await prisma.company.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (company) {
    await prisma.integrationConnection.updateMany({
      where: { companyId: company.id, provider: "google" },
      data: { status: "disconnected", accessTokenEncrypted: "revoked", refreshTokenEncrypted: null },
    });
  }
  return NextResponse.redirect(`${appUrl()}/app/tools?google=disconnected`, 303);
}
