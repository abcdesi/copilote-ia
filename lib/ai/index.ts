import { runMockChat, runMockDiagnostic } from "./mock-engine";
import { ChatContext, ChatMessageInput, ChatReply, DiagnosticResult } from "./types";

export type { ChatContext, ChatMessageInput, ChatReply, DiagnosticResult } from "./types";

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
    return runMockDiagnostic(input, existingTools);
  }
}

export async function runChat(messages: ChatMessageInput[], context: ChatContext): Promise<ChatReply> {
  if (!hasClaudeKey()) {
    return runMockChat(messages, context);
  }
  try {
    return { reply: await runClaudeChat(messages, context) };
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
  return runMockDiagnostic(input, existingTools);
}

async function runClaudeChat(messages: ChatMessageInput[], context: ChatContext): Promise<string> {
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
- Quand c'est utile, termine par une seule prochaine action claire.
`;

  const transcript = messages
    .slice(-10)
    .map((message) => `${message.role === "user" ? "Utilisateur" : "Pilotzia"}: ${message.content}`)
    .join("\n");

  return callClaude(
    system,
    `Voici les derniers échanges de la conversation. Réponds au dernier message en tenant compte de l'historique :\n\n${transcript}`
  );
}
