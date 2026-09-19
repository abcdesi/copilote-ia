import { z } from "zod";
import { extractAnthropicText } from "./anthropic-response";
import { runMockDiagnostic } from "./mock-engine";
import { runExpertFallbackChat } from "./expert-fallback";
import { ChatContext, ChatMessageInput, ChatReply, DiagnosticResult } from "./types";
import { AUTOMATION_CATALOG } from "@/lib/automations/catalog";
import { HOURLY_RATE_EUR, KNOWN_TOOLS } from "@/lib/automations/types";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { assessAdviceMaturity, maturityInstruction } from "./advice-maturity";
import { findConfidentTemplateMatch, findRecommendedTemplateMatch, isCorrectionRequest, isExplicitAutomationRequest } from "./advisor-policy";
import {
  compactExpertEvidence,
  expertOperatingDoctrine,
  inferConversationIntent,
} from "./expert-response-policy";

export type { ChatContext, ChatMessageInput, ChatReply, DiagnosticResult } from "./types";

const hasClaudeKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

type AiMode = "fast" | "smart";

const diagnosticSchema = z.object({
  automationScore: z.number().min(0).max(100),
  detectedTools: z.array(z.string()).max(20),
  templateIds: z.array(z.string()).max(6),
  summary: z.string().min(1).max(700),
});

export async function runDiagnostic(input: string, existingTools: string[] = [], companyId?: string): Promise<DiagnosticResult> {
  if (!hasClaudeKey()) return runMockDiagnostic(input, existingTools);
  try {
    return await runClaudeDiagnostic(input, existingTools, companyId);
  } catch (error) {
    console.error("Real diagnostic fallback", error);
    return runMockDiagnostic(input, existingTools);
  }
}

export async function runChat(messages: ChatMessageInput[], context: ChatContext): Promise<ChatReply> {
  if (!hasClaudeKey()) return runExpertFallbackChat(messages, context);
  try {
    return await runClaudeChat(messages, context);
  } catch (error) {
    console.error("Real chat fallback", error);
    return runExpertFallbackChat(messages, context);
  }
}

function modelFor(mode: AiMode) {
  if (mode === "fast") return process.env.ANTHROPIC_MODEL_FAST || process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
  return process.env.ANTHROPIC_MODEL_SMART || process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

function estimateCostEur(mode: AiMode, inputTokens: number, outputTokens: number) {
  const prefix = mode === "fast" ? "AI_FAST" : "AI_SMART";
  const inputRate = Number(process.env[`${prefix}_INPUT_EUR_PER_MILLION`] ?? "");
  const outputRate = Number(process.env[`${prefix}_OUTPUT_EUR_PER_MILLION`] ?? "");
  if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate)) return null;
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}

async function callClaude(input: {
  system: string;
  userContent: string;
  mode: AiMode;
  companyId?: string;
  maxTokens?: number;
}) {
  const model = modelFor(input.mode);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens ?? (input.mode === "smart" ? 1400 : 800),
      system: input.system,
      messages: [{ role: "user", content: input.userContent }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  const text = extractAnthropicText(data?.content);
  if (!text) throw new Error("Claude API: empty response");

  const inputTokens = Number(data?.usage?.input_tokens ?? 0);
  const outputTokens = Number(data?.usage?.output_tokens ?? 0);
  if (input.companyId) {
    const estimatedCostEur = estimateCostEur(input.mode, inputTokens, outputTokens);
    await track(EVENTS.AI_USAGE, {
      companyId: input.companyId,
      metadata: {
        model,
        mode: input.mode,
        inputTokens,
        outputTokens,
        ...(estimatedCostEur == null ? {} : { estimatedCostEur: Number(estimatedCostEur.toFixed(6)) }),
      },
    }).catch(() => undefined);
  }
  return text as string;
}

function parseJsonObject(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Réponse JSON invalide.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function runClaudeDiagnostic(input: string, existingTools: string[], companyId?: string): Promise<DiagnosticResult> {
  const catalog = AUTOMATION_CATALOG.map((template) => ({
    id: template.id,
    title: template.title,
    category: template.category,
    goal: template.businessGoal,
    tools: template.relevantTools,
    impact: template.impactLevel,
  }));

  const text = await callClaude({
    mode: "smart",
    companyId,
    maxTokens: 1000,
    system: `Tu es le moteur de diagnostic Pilotzia. Analyse une entreprise et sélectionne uniquement des automatisations existantes dans le catalogue fourni. Ne crée aucun template. Réponds uniquement avec un objet JSON valide sans markdown: {"automationScore": number, "detectedTools": string[], "templateIds": string[], "summary": string}. Le score mesure le niveau d'automatisation actuel: 0 = très manuel, 100 = déjà très automatisé. Sélectionne 1 à 6 opportunités réellement pertinentes.`,
    userContent: `Description entreprise:\n${input}\n\nOutils déjà connus:\n${JSON.stringify(existingTools)}\n\nOutils reconnus par Pilotzia:\n${JSON.stringify(KNOWN_TOOLS)}\n\nCatalogue autorisé:\n${JSON.stringify(catalog)}`,
  });

  const parsed = diagnosticSchema.parse(parseJsonObject(text));
  const validIds = new Set(AUTOMATION_CATALOG.map((template) => template.id));
  const selected = parsed.templateIds.filter((id, index, all) => validIds.has(id) && all.indexOf(id) === index);
  if (selected.length === 0) throw new Error("Aucune opportunité catalogue valide.");

  const detectedTools = Array.from(
    new Set([
      ...existingTools,
      ...parsed.detectedTools.filter((tool) => (KNOWN_TOOLS as readonly string[]).includes(tool)),
    ])
  );

  const opportunities = selected
    .map((id) => AUTOMATION_CATALOG.find((template) => template.id === id))
    .filter((template): template is (typeof AUTOMATION_CATALOG)[number] => Boolean(template))
    .map((template) => ({
      templateId: template.id,
      title: template.title,
      description: template.description,
      category: template.category,
      impactLevel: template.impactLevel,
      complexity: template.complexity,
      estimatedHoursPerMonth: template.estimatedHoursPerMonth,
      estimatedValueEur: Math.round(template.estimatedHoursPerMonth * HOURLY_RATE_EUR),
      priceEur: template.priceEur,
      steps: template.steps,
    }));

  const potentialHoursPerMonth = opportunities.reduce((sum, opportunity) => sum + opportunity.estimatedHoursPerMonth, 0);
  const potentialValueEur = opportunities.reduce((sum, opportunity) => sum + opportunity.estimatedValueEur, 0);

  return {
    automationScore: Math.round(parsed.automationScore),
    detectedTools,
    opportunities,
    potentialHoursPerMonth,
    potentialValueEur,
    summary: parsed.summary,
  };
}

function shouldUseSmartModel(message: string) {
  const intent = inferConversationIntent(message);
  return (
    message.length > 420 ||
    (intent !== "general" && intent !== "automation") ||
    /analyse|stratég|strategie|plan|compare|diagnostic|priorit|pourquoi|optimis|rentabil|direction|conseil|audit|bilan|compte de résultat|compte de resultat|roi|risque/i.test(
      message
    )
  );
}

function matchCatalogTemplate(message: string, tools: string[]) {
  return findConfidentTemplateMatch(message, AUTOMATION_CATALOG, tools)?.id;
}

function isAcknowledgement(message: string) {
  return /^(ok|okay|d'accord|dac|oui|compris|vas-y|go|parfait|tres bien|tr[eè]s bien)[.!\s]*$/i.test(message.trim());
}

async function runClaudeChat(messages: ChatMessageInput[], context: ChatContext): Promise<ChatReply> {
  const maturity = assessAdviceMaturity(context);
  const evidence = compactExpertEvidence(messages, context);
  const doctrine = expertOperatingDoctrine(messages, context);

  const system = `Tu es Pilotzia, le copilote opérationnel de ${context.companyName}. Ton niveau attendu est celui d'un consultant de direction expérimenté qui sait aussi agir dans un logiciel opérationnel.

${doctrine}

NIVEAU DE CONNAISSANCE
- maturité : ${maturity.level} (${maturity.score}/100)
- signaux disponibles : ${maturity.knownSignals.join(", ") || "très peu"}
- signaux manquants : ${maturity.missingSignals.join(", ") || "aucun majeur"}

CALIBRAGE
${maturityInstruction(maturity)}

DOSSIER ENTREPRISE CIBLÉ — UTILISE-LE, NE LE RÉCITE PAS
${JSON.stringify(evidence, null, 2)}

HIÉRARCHIE DE PREUVE
1. observations réelles et données connectées fraîches ;
2. faits structurés récents du Business Graph avec provenance et confiance ;
3. informations déclarées actuelles par l'utilisateur ;
4. opportunités/estimations Pilotzia ;
5. bonnes pratiques générales ;
6. hypothèses.
Quand deux sources se contredisent, privilégie la plus récente, la plus directe et la mieux sourcée. Une déclaration marquée ancienne ou à actualiser ne doit pas être utilisée comme si elle décrivait nécessairement la situation actuelle.

LIMITES
- N'invente jamais un chiffre, une connexion, un benchmark client, une lecture de document ou une action exécutée.
- N'utilise jamais des données privées d'une autre entreprise comme exemple ou benchmark individuel.
- Une estimation catalogue n'est pas une mesure réelle.
- Pour une action sensible ou irréversible, exige une validation explicite.
- Si Pilotzia ne dispose pas encore d'une donnée nécessaire, explique exactement laquelle permettrait de trancher ; ne transforme pas cela en interrogatoire.

OBJECTIF DE CHAQUE RÉPONSE
Faire progresser une décision métier avec le minimum d'informations réellement utiles. L'utilisateur doit sentir que tu comprends sa situation actuelle, que tu sais quelles données mobiliser pour le sujet précis et que tu distingues conseil, preuve, hypothèse et action.`;

  const transcriptMessages = messages.slice(-12);
  const transcript = transcriptMessages
    .map((message) => `${message.role === "user" ? "Utilisateur" : "Pilotzia"}: ${message.content}`)
    .join("\n");
  const lastUserIndex = transcriptMessages.map((message) => message.role).lastIndexOf("user");
  const lastUserMessage = lastUserIndex >= 0 ? transcriptMessages[lastUserIndex].content : "";
  const previousAssistant = [...transcriptMessages.slice(0, lastUserIndex)]
    .reverse()
    .find((message) => message.role === "assistant")?.content ?? "";

  const hints: string[] = [];
  if (isAcknowledgement(lastUserMessage)) {
    hints.push("Le dernier message est un acquiescement : poursuis la décision en cours, sans redemander l'objectif.");
  }
  if (isCorrectionRequest(lastUserMessage)) {
    hints.push("Le dernier message signale que la réponse précédente n'a pas convenu : répare-la directement, plus simplement et plus concrètement, sans repartir de zéro.");
  }
  if (lastUserMessage.trim().length <= 80 && previousAssistant.includes("?")) {
    hints.push("Le dernier message court est probablement la réponse à la question précédente : traite-le comme une information acquise et avance d'un cran.");
  }
  if (hints.length === 0) hints.push("Réponds directement au dernier message dans la continuité de l'échange.");

  const reply = await callClaude({
    system,
    userContent: `${hints.join("\n")}\n\nConversation récente :\n${transcript}`,
    mode: shouldUseSmartModel(lastUserMessage) ? "smart" : "fast",
    companyId: context.companyId,
  });

  const explicitTemplateId = isExplicitAutomationRequest(lastUserMessage)
    ? matchCatalogTemplate(lastUserMessage, context.tools)
    : undefined;
  const recommendedTemplate = explicitTemplateId
    ? AUTOMATION_CATALOG.find((template) => template.id === explicitTemplateId)
    : findRecommendedTemplateMatch(reply, AUTOMATION_CATALOG, context.tools);
  const alreadyInstalled = recommendedTemplate
    ? context.automations.some((automation) => automation.name.toLowerCase() === recommendedTemplate.title.toLowerCase())
    : false;
  const matchedTemplateId = alreadyInstalled ? undefined : recommendedTemplate?.id;
  const matchedTemplateSource = matchedTemplateId
    ? explicitTemplateId
      ? "explicit_request" as const
      : "assistant_recommendation" as const
    : undefined;

  return { reply, matchedTemplateId, matchedTemplateSource };
}
