import { z } from "zod";
import type { FinancialStatementInput } from "@/lib/intelligence/financial-audit";

const extractedFinancialSchema = z.object({
  documentType: z.enum(["balance_sheet", "income_statement", "combined", "other"]),
  periodLabel: z.string().min(1).max(120),
  periodMonths: z.number().int().min(1).max(24).nullable(),
  currency: z.string().min(1).max(12).nullable(),
  unitMultiplier: z.number().positive().max(1_000_000_000),
  revenue: z.number().nullable(),
  grossProfit: z.number().nullable(),
  operatingProfit: z.number().nullable(),
  netIncome: z.number().nullable(),
  cash: z.number().nullable(),
  accountsReceivable: z.number().nullable(),
  accountsPayable: z.number().nullable(),
  inventory: z.number().nullable(),
  currentAssets: z.number().nullable(),
  currentLiabilities: z.number().nullable(),
  totalDebt: z.number().nullable(),
  equity: z.number().nullable(),
  payrollExpense: z.number().nullable(),
  operatingExpenses: z.number().nullable(),
  extractionConfidence: z.number().min(0).max(1),
  warnings: z.array(z.string().max(300)).max(12),
});

export type FinancialDocumentErrorCode =
  | "provider_not_configured"
  | "provider_auth"
  | "provider_rate_limited"
  | "provider_unavailable"
  | "model_unavailable"
  | "document_rejected"
  | "extraction_empty"
  | "extraction_truncated"
  | "extraction_invalid";

export class FinancialDocumentError extends Error {
  code: FinancialDocumentErrorCode;
  providerStatus?: number;

  constructor(code: FinancialDocumentErrorCode, message: string, providerStatus?: number) {
    super(message);
    this.name = "FinancialDocumentError";
    this.code = code;
    this.providerStatus = providerStatus;
  }
}

export interface FinancialDocumentExtraction {
  statement: FinancialStatementInput;
  documentType: z.infer<typeof extractedFinancialSchema>["documentType"];
  extractionConfidence: number;
  warnings: string[];
  model: string;
  inputTokens: number;
  outputTokens: number;
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new FinancialDocumentError("extraction_invalid", "Réponse d'extraction JSON invalide.");
  }
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new FinancialDocumentError("extraction_invalid", "Réponse d'extraction JSON illisible.");
  }
}

function scale(value: number | null, multiplier: number) {
  return value == null ? null : value * multiplier;
}

function supportsDisabledThinking(model: string) {
  return /^claude-(?:sonnet|opus)-5(?:$|-)/.test(model);
}

function providerError(status: number, detail: string) {
  if (status === 401 || status === 403) {
    return new FinancialDocumentError("provider_auth", "Authentification Anthropic refusée.", status);
  }
  if (status === 404) {
    return new FinancialDocumentError("model_unavailable", "Le modèle Anthropic configuré est indisponible.", status);
  }
  if (status === 429) {
    return new FinancialDocumentError("provider_rate_limited", "Anthropic limite temporairement les requêtes.", status);
  }
  if (status === 400 || status === 413 || status === 422) {
    return new FinancialDocumentError("document_rejected", detail || "Le document a été refusé par le moteur d'analyse.", status);
  }
  return new FinancialDocumentError("provider_unavailable", detail || "Le moteur Anthropic est temporairement indisponible.", status);
}

async function providerFailureDetail(response: Response) {
  const raw = await response.text().catch(() => "");
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    return parsed.error?.message || parsed.message || raw.slice(0, 260);
  } catch {
    return raw.slice(0, 260);
  }
}

export async function extractFinancialStatementFromPdf(input: {
  pdfBytes: Uint8Array;
  filename?: string;
}): Promise<FinancialDocumentExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new FinancialDocumentError("provider_not_configured", "ANTHROPIC_API_KEY manquante pour l'analyse financière.");
  }

  const model = process.env.ANTHROPIC_MODEL_SMART || process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  const pdfBase64 = Buffer.from(input.pdfBytes).toString("base64");
  const instruction = `Tu es le moteur d'extraction financière de Pilotzia. Lis ce PDF comptable ou financier et retourne uniquement un objet JSON valide, sans markdown et sans commentaire.

RÈGLES ABSOLUES
- N'invente aucune valeur. Si un poste n'est pas clairement présent ou calculable sans ambiguïté, mets null.
- Respecte le signe comptable affiché dans le document. Ne transforme pas une perte en valeur positive.
- Identifie l'unité affichée (euros, milliers d'euros, millions, etc.) dans unitMultiplier. Exemples: unités = 1, k€ = 1000, M€ = 1000000.
- Les montants JSON doivent être les nombres tels qu'ils apparaissent AVANT application de unitMultiplier.
- periodMonths = durée couverte par le compte de résultat si elle est clairement déterminable, sinon null. Un bilan seul peut avoir periodMonths=null.
- totalDebt doit viser la dette financière lorsqu'elle est identifiable, pas la totalité du passif.
- operatingExpenses et payrollExpense doivent rester null si le document ne permet pas de les isoler proprement.
- extractionConfidence entre 0 et 1 reflète la fiabilité de l'extraction, pas la santé financière.
- warnings doit signaler unités ambiguës, pages manquantes, comparatifs confondables, OCR difficile ou classifications incertaines.
- Vérifie que le JSON est complet avant de terminer la réponse.

FORMAT EXACT
{
  "documentType":"balance_sheet|income_statement|combined|other",
  "periodLabel":"...",
  "periodMonths":12,
  "currency":"EUR",
  "unitMultiplier":1,
  "revenue":null,
  "grossProfit":null,
  "operatingProfit":null,
  "netIncome":null,
  "cash":null,
  "accountsReceivable":null,
  "accountsPayable":null,
  "inventory":null,
  "currentAssets":null,
  "currentLiabilities":null,
  "totalDebt":null,
  "equity":null,
  "payrollExpense":null,
  "operatingExpenses":null,
  "extractionConfidence":0.0,
  "warnings":[]
}

Nom du fichier fourni : ${input.filename || "document.pdf"}.`;

  const body: Record<string, unknown> = {
    model,
    max_tokens: 3200,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          { type: "text", text: instruction },
        ],
      },
    ],
  };

  // Sonnet 5 active le reasoning par défaut. Pour une extraction JSON déterministe,
  // on le désactive afin qu'il ne consomme pas le budget de sortie avant le JSON utile.
  if (supportsDisabledThinking(model)) body.thinking = { type: "disabled" };

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(80_000),
    });
  } catch (error) {
    throw new FinancialDocumentError(
      "provider_unavailable",
      error instanceof Error ? error.message : "Connexion au moteur Anthropic impossible."
    );
  }

  if (!response.ok) {
    const detail = await providerFailureDetail(response);
    throw providerError(response.status, detail);
  }

  const data = await response.json();
  if (data?.stop_reason === "max_tokens") {
    throw new FinancialDocumentError("extraction_truncated", "La réponse d'extraction a été interrompue avant la fin.");
  }
  if (data?.stop_reason === "refusal") {
    throw new FinancialDocumentError("document_rejected", "Le moteur n'a pas pu traiter ce document.");
  }

  const textParts = Array.isArray(data?.content)
    ? data.content.filter((part: { type?: string; text?: string }) => part.type === "text" && typeof part.text === "string")
    : [];
  const text = textParts.map((part: { text: string }) => part.text).join("\n").trim();
  if (!text) throw new FinancialDocumentError("extraction_empty", "Le moteur d'extraction n'a renvoyé aucun résultat exploitable.");

  let extracted: z.infer<typeof extractedFinancialSchema>;
  try {
    extracted = extractedFinancialSchema.parse(parseJsonObject(text));
  } catch (error) {
    if (error instanceof FinancialDocumentError) throw error;
    if (error instanceof z.ZodError) {
      throw new FinancialDocumentError("extraction_invalid", "Le document a été lu, mais les données extraites ne respectent pas le format attendu.");
    }
    throw error;
  }

  const m = extracted.unitMultiplier;
  const statement: FinancialStatementInput = {
    periodLabel: extracted.periodLabel,
    periodMonths: extracted.periodMonths,
    currency: extracted.currency,
    revenue: scale(extracted.revenue, m),
    grossProfit: scale(extracted.grossProfit, m),
    operatingProfit: scale(extracted.operatingProfit, m),
    netIncome: scale(extracted.netIncome, m),
    cash: scale(extracted.cash, m),
    accountsReceivable: scale(extracted.accountsReceivable, m),
    accountsPayable: scale(extracted.accountsPayable, m),
    inventory: scale(extracted.inventory, m),
    currentAssets: scale(extracted.currentAssets, m),
    currentLiabilities: scale(extracted.currentLiabilities, m),
    totalDebt: scale(extracted.totalDebt, m),
    equity: scale(extracted.equity, m),
    payrollExpense: scale(extracted.payrollExpense, m),
    operatingExpenses: scale(extracted.operatingExpenses, m),
  };

  return {
    statement,
    documentType: extracted.documentType,
    extractionConfidence: extracted.extractionConfidence,
    warnings: extracted.warnings,
    model,
    inputTokens: Number(data?.usage?.input_tokens ?? 0),
    outputTokens: Number(data?.usage?.output_tokens ?? 0),
  };
}
