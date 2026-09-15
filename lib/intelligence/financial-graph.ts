import { prisma } from "@/lib/db/client";
import type { FinancialAuditResult, FinancialStatementInput } from "@/lib/intelligence/financial-audit";

interface PersistFinancialAuditInput {
  companyId: string;
  documentKey: string;
  documentType: string;
  extractionConfidence: number;
  statement: FinancialStatementInput;
  audit: FinancialAuditResult;
  model: string;
  warningsCount: number;
}

const FINANCIAL_FIELDS: Array<keyof FinancialStatementInput> = [
  "revenue",
  "grossProfit",
  "operatingProfit",
  "netIncome",
  "cash",
  "accountsReceivable",
  "accountsPayable",
  "inventory",
  "currentAssets",
  "currentLiabilities",
  "totalDebt",
  "equity",
  "payrollExpense",
  "operatingExpenses",
];

export async function persistFinancialAuditToBusinessGraph(input: PersistFinancialAuditInput) {
  const observedAt = new Date();
  const sourcePrefix = `finance:${input.documentKey}`;
  const confidence = Math.max(0, Math.min(1, input.extractionConfidence));

  const [company, document] = await Promise.all([
    prisma.businessEntity.upsert({
      where: {
        companyId_type_canonicalKey: {
          companyId: input.companyId,
          type: "company",
          canonicalKey: input.companyId,
        },
      },
      create: {
        companyId: input.companyId,
        type: "company",
        canonicalKey: input.companyId,
        name: "Entreprise",
        confidence: 1,
        sourceCount: 1,
      },
      update: { lastSeenAt: observedAt },
    }),
    prisma.businessEntity.upsert({
      where: {
        companyId_type_canonicalKey: {
          companyId: input.companyId,
          type: "document",
          canonicalKey: `financial:${input.documentKey}`,
        },
      },
      create: {
        companyId: input.companyId,
        type: "document",
        canonicalKey: `financial:${input.documentKey}`,
        name: `État financier · ${input.statement.periodLabel}`,
        status: "active",
        attributesJson: JSON.stringify({
          documentType: input.documentType,
          periodLabel: input.statement.periodLabel,
          extractionConfidence: confidence,
          rawDocumentStored: false,
        }),
        confidence,
        sourceCount: 1,
        firstSeenAt: observedAt,
        lastSeenAt: observedAt,
      },
      update: {
        name: `État financier · ${input.statement.periodLabel}`,
        attributesJson: JSON.stringify({
          documentType: input.documentType,
          periodLabel: input.statement.periodLabel,
          extractionConfidence: confidence,
          rawDocumentStored: false,
        }),
        confidence,
        lastSeenAt: observedAt,
      },
    }),
  ]);

  await prisma.businessFact.deleteMany({
    where: { companyId: input.companyId, sourceRef: { startsWith: `${sourcePrefix}:` } },
  });

  const provenance = {
    method: "financial_pdf_extraction_then_deterministic_audit",
    model: input.model,
    documentType: input.documentType,
    periodLabel: input.statement.periodLabel,
    rawDocumentStored: false,
    warningsCount: input.warningsCount,
  };

  const facts: Array<{
    subjectEntityId: string;
    predicate: string;
    objectEntityId?: string | null;
    value?: unknown;
    sourceRef: string;
    confidence: number;
  }> = [
    {
      subjectEntityId: company.id,
      predicate: "has_financial_document",
      objectEntityId: document.id,
      sourceRef: `${sourcePrefix}:document`,
      confidence,
    },
  ];

  for (const field of FINANCIAL_FIELDS) {
    const value = input.statement[field];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    facts.push({
      subjectEntityId: document.id,
      predicate: "financial_metric",
      value: { key: field, value, periodLabel: input.statement.periodLabel },
      sourceRef: `${sourcePrefix}:metric:${String(field)}`,
      confidence,
    });
  }

  for (const ratio of input.audit.ratios) {
    facts.push({
      subjectEntityId: document.id,
      predicate: "financial_ratio",
      value: {
        key: ratio.key,
        label: ratio.label,
        value: ratio.value,
        unit: ratio.unit,
        periodLabel: input.statement.periodLabel,
      },
      sourceRef: `${sourcePrefix}:ratio:${ratio.key}`,
      confidence,
    });
  }

  input.audit.alerts.slice(0, 20).forEach((alert, index) => {
    facts.push({
      subjectEntityId: document.id,
      predicate: "financial_alert",
      value: { text: alert, periodLabel: input.statement.periodLabel },
      sourceRef: `${sourcePrefix}:alert:${index}`,
      confidence,
    });
  });

  await prisma.$transaction(
    facts.map((fact) =>
      prisma.businessFact.create({
        data: {
          companyId: input.companyId,
          subjectEntityId: fact.subjectEntityId,
          predicate: fact.predicate,
          objectEntityId: fact.objectEntityId ?? null,
          valueJson: fact.value === undefined ? null : JSON.stringify(fact.value),
          sourceProvider: "pilotzia_finance",
          sourceRef: fact.sourceRef,
          confidence: fact.confidence,
          observedAt,
          provenanceJson: JSON.stringify(provenance),
        },
      })
    )
  );

  return { documentEntityId: document.id, factsWritten: facts.length };
}
