import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { normalizeTimeZone } from "@/lib/timezone";

const schema = z.object({
  timezone: z.string().min(1).max(120),
});

export async function POST(req: NextRequest) {
  let access;
  try {
    access = await requireCompanyPermission("edit_company");
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    }
    throw error;
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Fuseau horaire invalide." }, { status: 400 });

  const timezone = normalizeTimeZone(parsed.data.timezone);
  if (!timezone) return NextResponse.json({ error: "Fuseau horaire IANA invalide." }, { status: 400 });

  const current = await prisma.company.findUnique({
    where: { id: access.company.id },
    select: { timezone: true },
  });
  if (!current) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });
  if (current.timezone) {
    return NextResponse.json({ ok: true, changed: false, timezone: current.timezone });
  }

  const effectiveAt = new Date();
  await prisma.$transaction([
    prisma.company.update({
      where: { id: access.company.id },
      data: { timezone },
    }),
    prisma.companyContextRevision.create({
      data: {
        companyId: access.company.id,
        section: "local",
        field: "timezone",
        previousValueJson: null,
        nextValueJson: JSON.stringify(timezone),
        source: "browser_timezone_detection",
        effectiveAt,
      },
    }),
    prisma.event.create({
      data: {
        companyId: access.company.id,
        userId: access.session.user.id,
        type: "COMPANY_CONTEXT_UPDATED",
        metadata: JSON.stringify({
          sections: "local",
          fieldCount: 1,
          changedFields: "timezone",
          actorRole: access.role,
          effectiveAt: effectiveAt.toISOString(),
          source: "browser_timezone_detection",
        }),
      },
    }),
  ]);

  return NextResponse.json({ ok: true, changed: true, timezone });
}
