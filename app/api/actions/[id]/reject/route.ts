import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { rejectPendingAction } from "@/lib/actions/pending";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const company = await prisma.company.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });

  await rejectPendingAction(company.id, id);
  if (req.headers.get("accept")?.includes("application/json")) return NextResponse.json({ ok: true });
  return NextResponse.redirect(new URL("/app/actions?status=rejected", req.nextUrl.origin), 303);
}
