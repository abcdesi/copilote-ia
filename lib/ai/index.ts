import { z } from "zod";
import { runMockChat, runMockDiagnostic } from "./mock-engine";
import { ChatContext, ChatMessageInput, ChatReply, DiagnosticResult } from "./types";
import { AUTOMATION_CATALOG } from "@/lib/automations/catalog";
import { HOURLY_RATE_EUR, KNOWN_TOOLS } from "@/lib/automations/types";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";
import { assessAdviceMaturity, maturityInstruction } from "./advice-maturity";
import { isExplicitAutomationRequest } from "./advisor-policy";

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
  if (!hasClaudeKey()) return runMockChat(messages, context);
  try {
    return await runClaudeChat(messages, context);
  } catch (error) {
    console.error("Real chat fallback", error);
    return runMockChat(messages, context);
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
  const text = data?.content?.find?.((part: { type?: string }) => part.type === "text")?.text ?? data?.content?.[0]?.text;
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
  return message.length > 420 || /analyse|stratég|strategie|plan|compare|diagnostic|priorit|pourquoi|optimis|rentabil|direction|conseil/i.test(message);
}

function matchCatalogTemplate(message: string, tools: string[]) {
  const normalized = message.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const template of AUTOMATION_CATALOG) {
    const keywordScore = template.keywords.reduce((score, keyword) => score + (normalized.includes(keyword.toLowerCase()) ? 2 : 0), 0);
    const toolScore = template.relevantTools.reduce((score, tool) => score + (tools.includes(tool) ? 0.35 : 0), 0);
    const score = keywordScore + toolScore;
    if (score > 0 && (!best || score > best.score)) best = { id: template.id, score };
  }
  return best && best.score >= 2 ? best.id : undefined;
}

function isAcknowledgement(message: string) {
  return /^(ok|okay|d'accord|dac|oui|compris|vas-y|go|parfait|tres bien|tr[eè]s bien)[.!\s]*$/i.test(message.trim());
}

async function runClaudeChat(messages: ChatMessageInput[], context: ChatContext): Promise<ChatReply> {
  const maturity = assessAdviceMaturity(context);
  const connectedProviders = context.connections
    .filter((connection) => connection.status === "connected" || connection.status === "active")
    .map((connection) => connection.provider);

  const system = `Tu es Pilotzia, le copilote opérationnel de l'entreprise ${context.companyName}. Tu dois te comporter comme un consultant senior puis, quand le contexte devient riche, comme un directeur opérationnel chevronné qui connaît l'entreprise.

MISSION
Aider l'utilisateur à mieux décider : comprendre les problèmes, prioriser les leviers, challenger les évidences, recommander des actions et expliquer les arbitrages. Tu n'es ni un chatbot générique, ni un catalogue d'automatisations, ni un vendeur qui pousse une fonctionnalité hors sujet.

NIVEAU DE CONNAISSANCE ACTUEL
- maturité du contexte : ${maturity.level} (${maturity.score}/100)
- signaux disponibles : ${maturity.knownSignals.join(", ") || "très peu"}
- signaux manquants : ${maturity.missingSignals.join(", ") || "aucun majeur"}
- sources réellement connectées : ${connectedProviders.join(", ") || "aucune"}

CALIBRAGE DU CONSEIL
${maturityInstruction(maturity)}

CONTEXTE ENTREPRISE
${JSON.stringify(context, null, 2)}

RÈGLES DE RAISONNEMENT
- Commence par répondre à la vraie question. Ne récite pas le contexte brut.
- Plus le contexte est pauvre, plus tu dois parler en hypothèses et chercher la donnée qui ferait le plus progresser le diagnostic.
- Plus le contexte est riche et observé, plus tu dois être précis, priorisé, chiffré et exigeant.
- Distingue explicitement : faits connus, observations connectées, estimations, hypothèses.
- Ne prétends jamais connaître les performances d'entreprises similaires à partir de données clients privées. Tu peux utiliser des bonnes pratiques générales et des patterns métier, mais indique qu'il s'agit de références génériques si elles ne proviennent pas de benchmarks agrégés réellement disponibles.
- Ne prétends jamais avoir lu, modifié ou synchronisé une application externe si aucune intégration réelle n'est disponible dans le contexte.
- Ne transforme pas un simple mot-clé en recommandation définitive. Vérifie l'enjeu, la fréquence et l'impact métier.
- Pour une action sensible (suppression, paiement, désactivation, envoi massif, modification irréversible), demande confirmation.
- Les valeurs de temps et d'euros sont des estimations, jamais des garanties.
- Après un simple "ok", "d'accord" ou acquiescement, ne repars pas à zéro et ne demande pas à l'utilisateur de préciser son objectif. Poursuis la décision précédente et demande uniquement la donnée suivante la plus utile si elle manque.

FORMAT CONSEILLÉ POUR UNE QUESTION SÉRIEUSE
Utilise 3 ou 4 blocs courts maximum :
**Ma recommandation** — réponse directe et priorisée.
**Pourquoi** — faits et logique de décision.
**Niveau de confiance** — ce qui est connu versus supposé, uniquement si utile.
**Prochaine décision utile** — une seule action ou question.
Évite les longues listes et les formules creuses. Sois précis, sobre et actionnable.`;

  const transcript = messages
    .slice(-10)
    .map((message) => `${message.role === "user" ? "Utilisateur" : "Pilotzia"}: ${message.content}`)
    .join("\n");
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const continuationHint = isAcknowledgement(lastUserMessage)
    ? "Le dernier message est un acquiescement. Continue naturellement le raisonnement précédent sans redemander l'objectif."
    : "Réponds directement au dernier message.";

  const reply = await callClaude({
    system,
    userContent: `Voici les derniers échanges. ${continuationHint}\n\n${transcript}`,
    mode: shouldUseSmartModel(lastUserMessage) ? "smart" : "fast",
    companyId: context.companyId,
  });

  const matchedTemplateId = isExplicitAutomationRequest(lastUserMessage)
    ? matchCatalogTemplate(lastUserMessage, context.tools)
    : undefined;

  return { reply, matchedTemplateId };
}
