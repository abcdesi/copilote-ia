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
  if (start < 0 || end <= start) throw new Error("Réponse d'extraction JSON invalide.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function scale(value: number | null, multiplier: number) {
  return value == null ? null : value * multiplier;
}

export async function extractFinancialStatementFromPdf(input: {
  pdfBytes: Uint8Array;
  filename?: string;
}): Promise<FinancialDocumentExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante pour l'analyse financière.");

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

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1800,
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
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Analyse PDF impossible (${response.status}) : ${message.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.content?.find?.((part: { type?: string }) => part.type === "text")?.text ?? data?.content?.[0]?.text;
  if (!text) throw new Error("Le moteur d'extraction n'a renvoyé aucun résultat.");

  const extracted = extractedFinancialSchema.parse(parseJsonObject(text));
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
