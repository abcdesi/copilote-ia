import { NextRequest, NextResponse } from "next/server";
import { canApproveRisk, getCurrentCompanyAccess, hasCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { executePendingAction } from "@/lib/actions/pending";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getCurrentCompanyAccess();
  const { id } = await params;
  const action = await prisma.pendingAction.findFirst({ where: { id, companyId: access.company.id } });
  if (!action) return NextResponse.json({ error: "Action introuvable." }, { status: 404 });

  if (!canApproveRisk(access.role, action.riskLevel)) {
    return NextResponse.json(
      { error: "Votre rôle ne permet pas de valider ce niveau de risque.", riskLevel: action.riskLevel },
      { status: 403 }
    );
  }

  try {
    const result = await executePendingAction(access.company.id, id, {
      userId: access.session.user.id,
      role: access.role,
      name: access.session.user.name,
      email: access.session.user.email,
    });
    if (req.headers.get("accept")?.includes("application/json")) return NextResponse.json({ result });
    return NextResponse.redirect(new URL("/app/actions?status=executed", req.nextUrl.origin), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exécution impossible.";
    if (message === "GOOGLE_ACTION_SCOPE_REQUIRED") {
      const canAuthorize = hasCompanyPermission(access.role, "manage_integrations");
      const payload = {
        error: canAuthorize
          ? "Google est connecté en lecture seule. Une autorisation supplémentaire est requise pour cette action."
          : "Google est connecté en lecture seule. Demandez à un propriétaire ou administrateur d'autoriser les actions Google.",
        authorizationRequired: true,
        href: canAuthorize ? "/api/integrations/google/connect?mode=action" : "/app/tools",
      };
      if (req.headers.get("accept")?.includes("application/json")) return NextResponse.json(payload, { status: 409 });
      return NextResponse.redirect(new URL(canAuthorize ? "/app/tools?google=action-scope-required" : "/app/tools?google=permission-denied", req.nextUrl.origin), 303);
    }

    if (req.headers.get("accept")?.includes("application/json")) return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.redirect(new URL("/app/actions?status=failed", req.nextUrl.origin), 303);
  }
}
