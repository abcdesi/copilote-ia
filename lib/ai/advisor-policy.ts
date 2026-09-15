import { AutomationTemplate } from "@/lib/automations/types";

const GENERIC_KEYWORDS = new Set([
  "question",
  "client",
  "équipe",
  "equipe",
  "suivi",
  "outil",
  "application",
  "réponse",
  "reponse",
  "rapport",
  "alerte",
  "notification",
  "contenu",
]);

const EXPLICIT_AUTOMATION_INTENT =
  /\b(automatise|automatiser|automatisation|crée une automatisation|cree une automatisation|ajoute.*opportunit|mets? en place|workflow|processus automatique)\b/i;

const CORRECTION_INTENT =
  /\b(tu n['’]?as pas répondu|ça ne répond pas|ca ne repond pas|hors sujet|ce n['’]?est pas ma question|réponds à ma question|reponds a ma question)\b/i;

export function isExplicitAutomationRequest(message: string) {
  return EXPLICIT_AUTOMATION_INTENT.test(message);
}

export function isCorrectionRequest(message: string) {
  return CORRECTION_INTENT.test(message);
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function keywordWeight(keyword: string) {
  const normalized = normalize(keyword);
  if (GENERIC_KEYWORDS.has(keyword.toLowerCase()) || GENERIC_KEYWORDS.has(normalized)) return 0.25;
  if (normalized.includes(" ")) return 2.5;
  return 1;
}

export function scoreTemplateIntent(message: string, template: AutomationTemplate, tools: string[]) {
  const normalizedMessage = normalize(message);
  let keywordScore = 0;
  let strongMatches = 0;

  for (const keyword of template.keywords) {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedMessage.includes(normalizedKeyword)) continue;
    const weight = keywordWeight(keyword);
    keywordScore += weight;
    if (weight >= 1) strongMatches += 1;
  }

  const toolScore = template.relevantTools.reduce((score, tool) => score + (tools.includes(tool) ? 0.2 : 0), 0);
  return { keywordScore, toolScore, strongMatches, score: keywordScore + toolScore };
}

/**
 * Conservative catalogue matching for conversational use. Generic words must never
 * be enough to create a business recommendation.
 */
export function findConfidentTemplateMatch(message: string, templates: AutomationTemplate[], tools: string[]) {
  if (isCorrectionRequest(message)) return undefined;

  const ranked = templates
    .map((template) => ({ template, ...scoreTemplateIntent(message, template, tools) }))
    .filter((candidate) => candidate.strongMatches > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) return undefined;

  const second = ranked[1];
  const hasEnoughEvidence = best.strongMatches >= 2 || best.keywordScore >= 2.5;
  const clearlyAhead = !second || best.score - second.score >= 0.75;

  return hasEnoughEvidence && clearlyAhead ? best.template : undefined;
}
