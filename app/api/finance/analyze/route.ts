import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/companies/current";
import { prisma } from "@/lib/db/client";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import { reserveUsage, refundUsage } from "@/lib/billing/usage-policy";
import {
  extractFinancialStatementFromPdf,
  FinancialDocumentError,
  type FinancialDocumentErrorCode,
} from "@/lib/intelligence/financial-document";
import { auditFinancialStatement } from "@/lib/intelligence/financial-audit";
import { deriveFinancialPriorities } from "@/lib/intelligence/financial-opportunities";
import { persistFinancialAuditToBusinessGraph } from "@/lib/intelligence/financial-graph";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const maxDuration = 90;

// Vercel Functions limitent les payloads entrants à 4,5 Mo. On garde une marge
// pour l'enveloppe multipart afin d'éviter un échec avant même l'exécution de la route.
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const AUDIT_CREDITS = 15;
const AUDIT_COST_RESERVE_EUR = Number(process.env.PILOTZIA_FINANCIAL_AUDIT_RESERVE_EUR || "0.50");

type PublicFailure = {
  status: number;
  error: string;
  retryable: boolean;
};

function publicFailure(code: FinancialDocumentErrorCode): PublicFailure {
  switch (code) {
    case "provider_not_configured":
      return {
        status: 503,
        error: "Le moteur d'analyse financière n'est pas encore configuré. Réessayez après activation du fournisseur IA.",
        retryable: false,
      };
    case "provider_auth":
      return {
        status: 503,
        error: "Le moteur d'analyse financière est temporairement indisponible à cause de sa configuration.",
        retryable: false,
      };
    case "model_unavailable":
      return {
        status: 503,
        error: "Le modèle d'analyse financière configuré n'est pas disponible. La configuration doit être vérifiée.",
        retryable: false,
      };
    case "provider_rate_limited":
      return {
        status: 503,
        error: "Le moteur d'analyse est momentanément saturé. Réessayez dans quelques instants.",
        retryable: true,
      };
    case "provider_unavailable":
      return {
        status: 503,
        error: "Le moteur d'analyse financière ne répond pas pour le moment. Réessayez dans quelques instants.",
        retryable: true,
      };
    case "extraction_truncated":
      return {
        status: 422,
        error: "Le document a été lu mais l'extraction s'est interrompue avant la fin. Réessayez ; si cela persiste, utilisez un PDF plus court.",
        retryable: true,
      };
    case "extraction_empty":
      return {
        status: 422,
        error: "Le PDF ne contient pas assez de contenu exploitable pour l'audit. Essayez un PDF texte ou un scan plus lisible.",
        retryable: false,
      };
    case "extraction_invalid":
      return {
        status: 422,
        error: "Le document a été lu, mais les données financières n'ont pas pu être structurées de façon fiable. Vérifiez la lisibilité du PDF puis réessayez.",
        retryable: true,
      };
    case "document_rejected":
    default:
      return {
        status: 422,
        error: "Ce PDF n'a pas pu être exploité de façon suffisamment fiable. Vérifiez qu'il s'agit bien d'un bilan ou compte de résultat lisible.",
        retryable: false,
      };
  }
}

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

  // On échoue avant toute réservation de crédits lorsque le fournisseur n'est pas configuré.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: "Le moteur d'analyse financière n'est pas encore configuré. Réessayez après activation du fournisseur IA.",
        code: "provider_not_configured",
        retryable: false,
        creditsRefunded: true,
        ...(isPilotziaAdmin(session.user.email) ? { adminHealthHref: "/api/admin/ai-health" } : {}),
      },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      {
        error: "Le fichier n'a pas pu être reçu. Utilisez un PDF de 4 Mo maximum.",
        code: "upload_invalid",
        retryable: false,
        creditsRefunded: true,
      },
      { status: 413 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ajoutez un fichier PDF." }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés pour cette version." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      {
        error: "Le PDF doit faire 4 Mo maximum.",
        code: "upload_too_large",
        retryable: false,
        creditsRefunded: true,
      },
      { status: 413 }
    );
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
    const priorities = deriveFinancialPriorities(extraction.statement, audit);

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
        prioritiesCount: priorities.length,
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
      priorities,
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

    const typed = error instanceof FinancialDocumentError ? error : null;
    const code: FinancialDocumentErrorCode = typed?.code ?? "provider_unavailable";
    const failure = publicFailure(code);

    await track(EVENTS.FINANCIAL_AUDIT_FAILED, {
      companyId: company.id,
      metadata: {
        code,
        providerStatus: typed?.providerStatus ?? null,
        model: process.env.ANTHROPIC_MODEL_SMART || process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      },
    }).catch(() => undefined);

    console.error("Financial PDF audit failed", {
      code,
      providerStatus: typed?.providerStatus,
      message: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      {
        error: failure.error,
        code,
        retryable: failure.retryable,
        creditsRefunded: true,
        ...(isPilotziaAdmin(session.user.email)
          ? {
              diagnostic: {
                providerStatus: typed?.providerStatus ?? null,
                model: process.env.ANTHROPIC_MODEL_SMART || process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
              },
              adminHealthHref: "/api/admin/ai-health",
            }
          : {}),
      },
      { status: failure.status }
    );
  }
}
