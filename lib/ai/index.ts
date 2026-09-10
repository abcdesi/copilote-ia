import { runMockChat, runMockDiagnostic } from "./mock-engine";
import { ChatContext, ChatMessageInput, DiagnosticResult } from "./types";

export type { ChatContext, ChatMessageInput, DiagnosticResult } from "./types";

const hasClaudeKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * Point d'entrée unique du copilote IA. Aucun composant UI ne doit appeler
 * directement un moteur (mock ou réel) — tout passe par ces deux fonctions,
 * ce qui permet de brancher un vrai modèle sans toucher au reste du produit.
 */
export async function runDiagnostic(input: string, existingTools: string[] = []): Promise<DiagnosticResult> {
  if (!hasClaudeKey()) {
    return runMockDiagnostic(input, existingTools);
  }
  try {
    return await runClaudeDiagnostic(input, existingTools);
  } catch {
    // Le moteur mock reste le filet de sécurité si l'API réelle échoue.
    return runMockDiagnostic(input, existingTools);
  }
}

export async function runChat(messages: ChatMessageInput[], context: ChatContext): Promise<string> {
  if (!hasClaudeKey()) {
    return runMockChat(messages, context);
  }
  try {
    return await runClaudeChat(messages, context);
  } catch {
    return runMockChat(messages, context);
  }
}

async function callClaude(system: string, userContent: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Claude API: empty response");
  return text as string;
}

async function runClaudeDiagnostic(input: string, existingTools: string[]): Promise<DiagnosticResult> {
  // Fallback conservateur : tant que le prompt/parsing JSON n'a pas été validé en conditions
  // réelles avec une vraie clé, on garde le moteur mock comme source de vérité pour le MVP.
  return runMockDiagnostic(input, existingTools);
}

async function runClaudeChat(messages: ChatMessageInput[], context: ChatContext): Promise<string> {
  const system = `Tu es le copilote d'automatisation de l'entreprise ${context.companyName}. Réponds de façon concise, orientée résultat, sans jargon technique. Contexte: ${JSON.stringify(
    context
  )}`;
  const lastUserMessage = messages[messages.length - 1]?.content ?? "";
  return callClaude(system, lastUserMessage);
}
