import { z } from "zod";
import { runMockChat, runMockDiagnostic } from "./mock-engine";
import { ChatContext, ChatMessageInput, ChatReply, DiagnosticResult } from "./types";
import { AUTOMATION_CATALOG } from "@/lib/automations/catalog";
import { HOURLY_RATE_EUR, KNOWN_TOOLS } from "@/lib/automations/types";
import { track } from "@/lib/analytics/track";
import { EVENTS } from "@/lib/analytics/events";

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
  return message.length > 420 || /analyse|stratég|strategie|plan|compare|diagnostic|priorit|pourquoi|optimis/i.test(message);
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

async function runClaudeChat(messages: ChatMessageInput[], context: ChatContext): Promise<ChatReply> {
  const system = `Tu es Pilotzia, le copilote opérationnel de l'entreprise ${context.companyName}.

MISSION
Aide l'utilisateur à comprendre ce qui mérite son attention, décider quoi améliorer et transformer ses demandes en actions concrètes. Tu n'es pas un chatbot générique ni un simple générateur d'automatisations.

CONTEXTE ENTREPRISE
${JSON.stringify(context, null, 2)}

RÈGLES
- Réponds en français, de façon concise, claire et orientée résultat.
- Utilise le contexte entreprise quand il est pertinent : objectifs, pertes de temps, outils, automatisations, santé, score et opportunités.
- Distingue toujours ce que Pilotzia sait de ce qu'il suppose.
- Ne prétends jamais avoir lu, modifié ou synchronisé une application externe si aucune intégration réelle n'est disponible dans le contexte.
- Pour une action sensible (suppression, paiement, désactivation, envoi massif, modification irréversible), demande explicitement confirmation avant de présenter l'action comme exécutée.
- Quand une demande peut être satisfaite par une automatisation, explique le résultat attendu avant la technique.
- Si une donnée manque, propose la prochaine étape la plus courte au lieu d'inventer.
- Les valeurs de temps et d'euros sont des estimations, jamais des garanties.
- Quand c'est utile, termine par une seule prochaine action claire.`;

  const transcript = messages
    .slice(-10)
    .map((message) => `${message.role === "user" ? "Utilisateur" : "Pilotzia"}: ${message.content}`)
    .join("\n");
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const reply = await callClaude({
    system,
    userContent: `Voici les derniers échanges. Réponds au dernier message en tenant compte de l'historique :\n\n${transcript}`,
    mode: shouldUseSmartModel(lastUserMessage) ? "smart" : "fast",
    companyId: context.companyId,
  });

  return { reply, matchedTemplateId: matchCatalogTemplate(lastUserMessage, context.tools) };
}
