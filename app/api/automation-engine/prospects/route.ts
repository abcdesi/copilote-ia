import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyN8nCallback } from "@/lib/n8n/callback-auth";
import { getRealExecutionConfig } from "@/lib/n8n/real-execution-config";

// Appelé par les workflows n8n "liste de contacts + email" (relance prospects,
// onboarding clients, suivi satisfaction...) : renvoie les contacts à recontacter pour
// ce templateId, ainsi que le message à envoyer (personnalisé par le client ou, à
// défaut, celui par défaut du template).
export async function GET(req: NextRequest) {
  if (!verifyN8nCallback(req)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const companyId = req.nextUrl.searchParams.get("companyId");
  // Valeur par défaut conservée pour compatibilité avec le tout premier workflow créé,
  // dont l'appel n'inclut pas templateId.
  const templateId = req.nextUrl.searchParams.get("templateId") || "relance-prospects";
  if (!companyId) {
    return NextResponse.json({ error: "companyId requis." }, { status: 400 });
  }

  const config = getRealExecutionConfig(templateId);
  if (!config) {
    return NextResponse.json({ error: "Template inconnu." }, { status: 400 });
  }

  const [prospects, automation] = await Promise.all([
    prisma.prospect.findMany({
      where: {
        companyId,
        templateId,
        status: "active",
        ...(config.recontactDays === null
          ? { lastContactedAt: null }
          : {
              OR: [
                { lastContactedAt: null },
                { lastContactedAt: { lte: new Date(Date.now() - config.recontactDays * 24 * 60 * 60 * 1000) } },
              ],
            }),
      },
      select: { id: true, name: true, email: true },
    }),
    prisma.automation.findFirst({
      where: { companyId, templateId },
      select: { messageSubject: true, messageBody: true },
    }),
  ]);

  return NextResponse.json({
    prospects,
    message: {
      subject: automation?.messageSubject || config.defaultSubject,
      body: automation?.messageBody || config.defaultBody,
    },
  });
}
