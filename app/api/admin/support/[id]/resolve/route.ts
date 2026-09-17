import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { prisma } from "@/lib/db/client";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isPilotziaAdmin(session?.user?.email)) return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 });

  const { id } = await params;
  await prisma.supportRequest.update({ where: { id }, data: { status: "resolved" } }).catch(() => null);
  return NextResponse.redirect(new URL("/app/admin/support", process.env.APP_URL || "http://localhost:3000"), 303);
}
