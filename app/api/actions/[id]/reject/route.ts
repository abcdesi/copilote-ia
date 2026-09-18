import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { rejectPendingAction } from "@/lib/actions/pending";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCompanyPermission("operate_automations");
    const { id } = await params;
    await rejectPendingAction(access.company.id, id, {
      userId: access.session.user.id,
      role: access.role,
      name: access.session.user.name,
      email: access.session.user.email,
    });
    if (req.headers.get("accept")?.includes("application/json")) return NextResponse.json({ ok: true });
    return NextResponse.redirect(new URL("/app/actions?status=rejected", req.nextUrl.origin), 303);
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.json({ error: "Permission insuffisante." }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Rejet impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
