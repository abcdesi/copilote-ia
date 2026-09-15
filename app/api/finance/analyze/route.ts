import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import { reserveUsage, refundUsage } from "@/lib/billing/usage-policy";
import { extractFinancialStatementFromPdf } from "@/lib/intelligence/financial-document";
import { auditFinancialStatement } from "@/lib/intelligence/financial-audit";
import { persistFinancialAuditToBusinessGraph } from "@/lib/intelligence/financial-graph";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

export const runtime = "nodejs";

const MAX_PDF_BYTES = 8 * 1024 * 1024;
const AUDIT_CREDITS = 15;
const AUDIT_COST_RESERVE_EUR = Number(process.env.PILOTZIA_FINANCIAL_AUDIT_RESERVE_EUR || "0.50");

export async function POST(req: NextRequest) {
  const session = await requireSession();
  const company = await prisma.company.findFirst({ where: { userId: session.user.id } });
  if (!company) return NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 });

  const entitlements = await getCompanyEntitlements(company.id);
  if (!entitlements.canUseFinancialAudit && !isPilotziaAdmin(session.user.email)) {
    return NextResponse.json(
      {
        error: "L'audit financier documentaire est inclus dans Scale.",
        upgradeRequired: true,
        href: "/app/settings",
      },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ajoutez un fichier PDF." }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés pour cette première version." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "Le PDF doit faire moins de 8 Mo." }, { status: 400 });
  }

  const reservation = await reserveUsage({
    companyId: company.id,
    kind: "ai_smart",
    credits: AUDIT_CREDITS,
    reservedCostEur: Number.isFinite(AUDIT_COST_RESERVE_EUR) ? AUDIT_COST_RESERVE_EUR : 0.5,
  });
  if (!reservation.allowed) {
    return NextResponse.json(
      {
        error: "Votre capacité d'analyse intelligente est arrivée à sa limite pour cette période.",
        usageLimited: true,
        reason: reservation.reason,
        href: "/app/settings",
      },
      { status: 429 }
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const documentKey = createHash("sha256").update(bytes).digest("hex");
    const extraction = await extractFinancialStatementFromPdf({ pdfBytes: bytes, filename: file.name });
    const audit = auditFinancialStatement(extraction.statement);

    const graphWrite = await persistFinancialAuditToBusinessGraph({
      companyId: company.id,
      documentKey,
      documentType: extraction.documentType,
      extractionConfidence: extraction.extractionConfidence,
      statement: extraction.statement,
      audit,
      model: extraction.model,
      warningsCount: extraction.warnings.length,
    }).catch((error) => {
      console.error("Financial audit Business Graph persistence failed", error);
      return null;
    });

    await track(EVENTS.FINANCIAL_AUDIT_COMPLETED, {
      companyId: company.id,
      metadata: {
        documentType: extraction.documentType,
        extractionConfidence: extraction.extractionConfidence,
        ratiosCount: audit.ratios.length,
        alertsCount: audit.alerts.length,
        questionsCount: audit.questions.length,
        warningsCount: extraction.warnings.length,
        graphFactsWritten: graphWrite?.factsWritten ?? 0,
        model: extraction.model,
        inputTokens: extraction.inputTokens,
        outputTokens: extraction.outputTokens,
        plan: entitlements.plan,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      extraction: {
        statement: extraction.statement,
        documentType: extraction.documentType,
        extractionConfidence: extraction.extractionConfidence,
        warnings: extraction.warnings,
      },
      audit,
      context: {
        businessGraphEnriched: Boolean(graphWrite),
        factsWritten: graphWrite?.factsWritten ?? 0,
      },
      privacy: {
        rawPdfStored: false,
        note: "Le PDF brut n'est pas enregistré dans la base Pilotzia par cette fonctionnalité. Seuls les éléments structurés utiles à l'audit peuvent enrichir le contexte de l'entreprise.",
      },
    });
  } catch (error) {
    await refundUsage({
      companyId: company.id,
      reservationId: reservation.reservationId,
      kind: "ai_smart",
      credits: AUDIT_CREDITS,
      reservedCostEur: Number.isFinite(AUDIT_COST_RESERVE_EUR) ? AUDIT_COST_RESERVE_EUR : 0.5,
    }).catch(() => undefined);
    await track(EVENTS.FINANCIAL_AUDIT_FAILED, {
      companyId: company.id,
      metadata: { reason: error instanceof Error ? error.message.slice(0, 180) : "unknown" },
    }).catch(() => undefined);
    console.error("Financial PDF audit failed", error);
    return NextResponse.json(
      { error: "Pilotzia n'a pas pu analyser ce document de façon suffisamment fiable. Vérifiez le PDF ou réessayez." },
      { status: 422 }
    );
  }
}
