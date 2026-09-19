import { NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { getOperatingBrief } from "@/lib/operating-company/brief";

export async function GET() {
  const session = await requireSession();
  const company = await prisma.company.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!company) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });

  const brief = await getOperatingBrief(company.id, 24);
  return NextResponse.json({ brief });
}
