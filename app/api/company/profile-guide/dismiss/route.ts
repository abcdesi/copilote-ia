import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentCompanyAccess } from "@/lib/companies/access";

const EVENT_TYPE = "COMPANY_PROFILE_GUIDE_DISMISSED";

export async function POST() {
  const access = await getCurrentCompanyAccess();

  const existing = await prisma.event.findFirst({
    where: {
      companyId: access.company.id,
      userId: access.session.user.id,
      type: EVENT_TYPE,
    },
    select: { id: true },
  });

  if (!existing) {
    await prisma.event.create({
      data: {
        companyId: access.company.id,
        userId: access.session.user.id,
        type: EVENT_TYPE,
        metadata: JSON.stringify({ dismissedAt: new Date().toISOString(), actorRole: access.role }),
      },
    });
  }

  return NextResponse.json({ dismissed: true });
}
