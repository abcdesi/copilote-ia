import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireCompanyPermission } from "@/lib/companies/access";
import { prisma } from "@/lib/db/client";
import { isPilotziaAdmin } from "@/lib/admin/access";
import { getCompanyEntitlements } from "@/lib/billing/entitlements";
import { reserveUsage, refundUsage } from "@/lib/billing/usage-policy";
import {
  extractFinancialStatementFromPdf,
  FinancialDocumentError,
  type FinancialDocumentErrorCode,
} from "@/lib/intelligence/financial-document";
import { assessDocumentIdentity } from "@/lib/intelligence/document-identity";
import { auditFinancialStatement } from "@/lib/intelligence/financial-audit";
import { deriveFinancialPriorities } from "@/lib/intelligence/financial-opportunities";
import { persistFinancialAuditToBusinessGraph } from "@/lib/intelligence/financial-graph";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const maxDuration = 90;

const MAX_PDF_BYTES = 4 * 1024 * 1024;
const AUDIT_CREDITS = 15;
const configuredAuditReserve = Number(process.env.PILOTZIA_FINANCIAL_AUDIT_RESERVE_EUR);
const AUDIT_COST_RESERVE_EUR = Number.isFinite(configuredAuditReserve) ? Math.max(0.5, configuredAuditReserve) : 0.5;
const MIN_GRAPH_EXTRACTION_CONFIDENCE = 0.65;

type PublicFailure = { status: number; error: string; retryable: boolean };

function publicFailure(code: FinancialDocumentErrorCode): PublicFailure {
  switch (code) {
    case "provider_not_configured":
      return { status: 503, error: "Le moteur d'analyse financière n'est pas encore configuré. Réessayez après activation du fournisseur IA.", retryable: false };
    case "provider_auth":
      return { status: 503, error: "Le moteur d'analyse financière est temporairement indisponible à cause de sa configuration.", retryable: false };
    case "model_unavailable":
      return { status: 503, error: "Le modèle d'analyse financière configuré n'est pas disponible. La configuration doit être vérifiée.", retryable: false };
    case "provider_rate_limited":
      return { status: 503, error: "Le moteur d'analyse est momentanément saturé. Réessayez dans quelques instants.", retryable: true };
    case "provider_unavailable":
      return { status: 503, error: "Le moteur d'analyse financière ne répond pas pour le moment. Réessayez dans quelques instants.", retryable: true };
    case "extraction_truncated":
      return { status: 422, error: "Le document a été lu mais l'extraction s'est interrompue avant la fin. Réessayez ; si cela persiste, utilisez un PDF plus court.", retryable: true };
    case "extraction_empty":
      return { status: 422, error: "Le PDF ne contient pas assez de contenu exploitable pour l'audit. Essayez un PDF texte ou un scan plus lisible.", retryable: false };
    case "extraction_invalid":
      return { status: 422, error: "Le document a été lu, mais les données financières n'ont pas pu être structurées de façon fiable. Vérifiez la lisibilité du PDF puis réessayez.", retryable: true };
    case "document_rejected":
    default:
      return { status: 422, error: "Ce PDF n'a pas pu être exploité de façon suffisamment fiable. Vérifiez qu'il s'agit bien d'un bilan ou compte de résultat lisible.", retryable: false };
  }
}

async function logDocumentAttempt(input: {
  companyId: string;
  userId: string;
  actorRole: string;
  documentHash: string;
  filename: string;
  sizeBytes: number;
  extractedCompanyName?: string | null;
  extractedCompanySiret?: string | null;
  identityStatus: string;
  identityConfidence?: number | null;
  decision: string;
  reason?: string | null;
  overrideReason?: string | null;
}) {
  await prisma.event.create({
    data: {
      userId: input.userId,
      companyId: input.companyId,
      type: "DOCUMENT_INGESTION_ATTEMPT",
      metadata: JSON.stringify({
        source: "finance_pdf",
        documentKind: "financial_statement",
        documentHash: input.documentHash,
        filename: input.filename.slice(0, 220),
        sizeBytes: input.sizeBytes,
        extractedCompanyName: input.extractedCompanyName ?? null,
        extractedCompanySiret: input.extractedCompanySiret ?? null,
        identityStatus: input.identityStatus,
        identityConfidence: input.identityConfidence ?? null,
        decision: input.decision,
        reason: input.reason ?? null,
        overrideReason: input.overrideReason ?? null,
        actorRole: input.actorRole,
        rawDocumentStored: false,
      }),
    },
  });
}

export async function POST(req: NextRequest) {
  let access: Awaited<ReturnType<typeof requireCompanyPermission>>;
  try {
    access = await requireCompanyPermission("manage_documents");
  } catch (error) {
    if (error instanceof Error && error.message === "COMPANY_PERMISSION_DENIED") {
      return NextResponse.json({ error: "Votre rôle ne permet pas d'intégrer des documents à l'entreprise." }, { status: 403 });
    }
    throw error;
  }

  const company = access.company;
  const session = access.session;
  const entitlements = await getCompanyEntitlements(company.id);
  if (!entitlements.canUseFinancialAudit && !isPilotziaAdmin(session.user.email)) {
    return NextResponse.json({ error: "L'audit financier documentaire est inclus dans Scale.", upgradeRequired: true, href: "/app/settings" }, { status: 403 });
  }

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
    return NextResponse.json({ error: "Le fichier n'a pas pu être reçu. Utilisez un PDF de 4 Mo maximum.", code: "upload_invalid", retryable: false, creditsRefunded: true }, { status: 413 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Ajoutez un fichier PDF." }, { status: 400 });
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Seuls les fichiers PDF sont acceptés pour cette version." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "Le PDF doit faire 4 Mo maximum.", code: "upload_too_large", retryable: false, creditsRefunded: true }, { status: 413 });
  }

  const confirmIdentityMismatch = formData.get("confirmIdentityMismatch") === "true";
  const identityOverrideReason = String(formData.get("identityOverrideReason") ?? "").trim();
  const reservation = await reserveUsage({
    companyId: company.id,
    kind: "ai_smart",
    credits: AUDIT_CREDITS,
    reservedCostEur: AUDIT_COST_RESERVE_EUR,
  });
  if (!reservation.allowed) {
    return NextResponse.json({ error: "Votre capacité d'analyse intelligente est arrivée à sa limite pour cette période.", usageLimited: true, reason: reservation.reason, href: "/app/settings" }, { status: 429 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const documentKey = createHash("sha256").update(bytes).digest("hex");
    const extraction = await extractFinancialStatementFromPdf({ pdfBytes: bytes, filename: file.name });
    const identity = assessDocumentIdentity({
      companyName: company.name,
      companySiret: company.siret,
      extractedCompanyName: extraction.documentIdentity.companyName,
      extractedCompanySiret: extraction.documentIdentity.siret,
      confidence: extraction.documentIdentity.confidence,
    });

    const identityConflict = identity.status === "mismatch" || identity.status === "review_required";
    if (identityConflict) {
      const canOverride = access.role === "owner" || access.role === "admin";
      const validOverride = confirmIdentityMismatch && canOverride && identityOverrideReason.length >= 8;

      if (!validOverride) {
        await Promise.all([
          refundUsage({
            companyId: company.id,
            reservationId: reservation.reservationId,
            kind: "ai_smart",
            credits: AUDIT_CREDITS,
            reservedCostEur: AUDIT_COST_RESERVE_EUR,
          }),
          logDocumentAttempt({
            companyId: company.id,
            userId: session.user.id,
            actorRole: access.role,
            documentHash: documentKey,
            filename: file.name,
            sizeBytes: file.size,
            extractedCompanyName: extraction.documentIdentity.companyName,
            extractedCompanySiret: extraction.documentIdentity.siret,
            identityStatus: identity.status,
            identityConfidence: extraction.documentIdentity.confidence,
            decision: "blocked_before_graph",
            reason: identity.reason,
          }),
        ]);

        return NextResponse.json(
          {
            error: identity.status === "mismatch"
              ? "Ce document semble appartenir à une autre entreprise. Pilotzia l'a bloqué avant toute intégration au Business Graph."
              : "L'identité de l'entreprise indiquée dans ce document ne correspond pas suffisamment au dossier courant. Une validation est requise avant intégration.",
            code: "document_company_mismatch",
            identity: {
              status: identity.status,
              detectedCompanyName: extraction.documentIdentity.companyName,
              detectedCompanySiret: extraction.documentIdentity.siret,
              confidence: extraction.documentIdentity.confidence,
              evidence: extraction.documentIdentity.evidence,
            },
            reviewRequired: true,
            canOverride,
            overrideRequirements: canOverride ? { confirmIdentityMismatch: true, identityOverrideReasonMinLength: 8 } : null,
            businessGraphEnriched: false,
            creditsRefunded: true,
            rawPdfStored: false,
          },
          { status: 409 }
        );
      }

      await logDocumentAttempt({
        companyId: company.id,
        userId: session.user.id,
        actorRole: access.role,
        documentHash: documentKey,
        filename: file.name,
        sizeBytes: file.size,
        extractedCompanyName: extraction.documentIdentity.companyName,
        extractedCompanySiret: extraction.documentIdentity.siret,
        identityStatus: identity.status,
        identityConfidence: extraction.documentIdentity.confidence,
        decision: "override_approved",
        reason: identity.reason,
        overrideReason: identityOverrideReason,
      });
    }

    const audit = auditFinancialStatement(extraction.statement);
    const priorities = deriveFinancialPriorities(extraction.statement, audit, {
      extractionConfidence: extraction.extractionConfidence,
      warnings: extraction.warnings,
    });
    const graphEligible = extraction.extractionConfidence >= MIN_GRAPH_EXTRACTION_CONFIDENCE;
    const graphWrite = graphEligible
      ? await persistFinancialAuditToBusinessGraph({
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
        })
      : null;

    if (!identityConflict || !graphEligible) {
      await logDocumentAttempt({
        companyId: company.id,
        userId: session.user.id,
        actorRole: access.role,
        documentHash: documentKey,
        filename: file.name,
        sizeBytes: file.size,
        extractedCompanyName: extraction.documentIdentity.companyName,
        extractedCompanySiret: extraction.documentIdentity.siret,
        identityStatus: identity.status,
        identityConfidence: extraction.documentIdentity.confidence,
        decision: !graphEligible ? "analyzed_low_confidence_not_integrated" : graphWrite ? "integrated" : "analyzed_graph_write_failed",
        reason: !graphEligible
          ? `Confiance d'extraction ${Math.round(extraction.extractionConfidence * 100)} %, sous le seuil d'intégration de ${Math.round(MIN_GRAPH_EXTRACTION_CONFIDENCE * 100)} %.`
          : identity.reason,
        overrideReason: identityConflict ? identityOverrideReason : null,
      }).catch(() => undefined);
    }

    await track(EVENTS.FINANCIAL_AUDIT_COMPLETED, {
      companyId: company.id,
      metadata: {
        actorUserId: session.user.id,
        actorRole: access.role,
        documentType: extraction.documentType,
        extractionConfidence: extraction.extractionConfidence,
        identityStatus: identity.status,
        identityOverride: identityConflict,
        graphEligible,
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
        identity: {
          status: identity.status,
          detectedCompanyName: extraction.documentIdentity.companyName,
          detectedCompanySiret: extraction.documentIdentity.siret,
          confidence: extraction.documentIdentity.confidence,
        },
      },
      audit,
      priorities,
      context: {
        businessGraphEnriched: Boolean(graphWrite),
        factsWritten: graphWrite?.factsWritten ?? 0,
        graphSkippedReason: !graphEligible ? "low_extraction_confidence" : graphWrite ? null : "graph_write_failed",
        minimumGraphConfidence: MIN_GRAPH_EXTRACTION_CONFIDENCE,
      },
      privacy: {
        rawPdfStored: false,
        documentFingerprintStored: true,
        note: "Le PDF brut n'est pas enregistré. Pilotzia conserve une empreinte cryptographique et les éléments structurés nécessaires à la traçabilité de l'analyse.",
      },
    });
  } catch (error) {
    await refundUsage({
      companyId: company.id,
      reservationId: reservation.reservationId,
      kind: "ai_smart",
      credits: AUDIT_CREDITS,
      reservedCostEur: AUDIT_COST_RESERVE_EUR,
    }).catch(() => undefined);

    const typed = error instanceof FinancialDocumentError ? error : null;
    const code: FinancialDocumentErrorCode = typed?.code ?? "provider_unavailable";
    const failure = publicFailure(code);

    await track(EVENTS.FINANCIAL_AUDIT_FAILED, {
      companyId: company.id,
      metadata: {
        actorUserId: session.user.id,
        actorRole: access.role,
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
