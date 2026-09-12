import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { executePendingAction } from "@/lib/actions/pending";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const company = await prisma.company.findFirst({ where: { userId: session.user.id }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });

  try {
    const result = await executePendingAction(company.id, id);
    if (req.headers.get("accept")?.includes("application/json")) return NextResponse.json({ result });
    return NextResponse.redirect(new URL("/app/actions?status=executed", req.nextUrl.origin), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exécution impossible.";
    if (req.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.redirect(new URL("/app/actions?status=failed", req.nextUrl.origin), 303);
  }
}
