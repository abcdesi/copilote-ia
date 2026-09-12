import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { buildGoogleAuthorizationUrl } from "@/lib/integrations/google";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const company = await prisma.company.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!company) return NextResponse.redirect(new URL("/app/tools?error=company", req.nextUrl.origin));
  return NextResponse.redirect(buildGoogleAuthorizationUrl(company.id));
}
