import { AUTOMATION_CATALOG } from "@/lib/automations/catalog";
import type { AutomationTemplate } from "@/lib/automations/types";

function normalizeRecommendationText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(value: string) {
  return new Set(
    normalizeRecommendationText(value)
      .split(" ")
      .filter((token) => token.length >= 4)
  );
}

function recommendationScore(reply: string, template: AutomationTemplate) {
  const normalizedReply = normalizeRecommendationText(reply);
  if (!normalizedReply) return 0;

  let score = 0;
  const normalizedTitle = normalizeRecommendationText(template.title);
  const normalizedGoal = normalizeRecommendationText(template.businessGoal);
  const normalizedDescription = normalizeRecommendationText(template.description);

  if (normalizedTitle.length >= 8 && normalizedReply.includes(normalizedTitle)) score += 12;
  if (normalizedGoal.length >= 12 && normalizedReply.includes(normalizedGoal)) score += 8;
  if (normalizedDescription.length >= 16 && normalizedReply.includes(normalizedDescription)) score += 6;

  let keywordHits = 0;
  let multiwordKeywordHits = 0;

  for (const keyword of template.keywords) {
    const normalizedKeyword = normalizeRecommendationText(keyword);
    if (!normalizedKeyword || !normalizedReply.includes(normalizedKeyword)) continue;

    keywordHits += 1;
    score += normalizedKeyword.includes(" ") ? 4 : 2;
    if (normalizedKeyword.includes(" ")) multiwordKeywordHits += 1;
  }

  const replyTokens = meaningfulTokens(reply);
  const templateTokens = meaningfulTokens(
    [template.title, template.businessGoal, template.description, ...template.keywords].join(" ")
  );
  let overlap = 0;
  for (const token of templateTokens) {
    if (replyTokens.has(token)) overlap += 1;
  }
  score += Math.min(6, overlap);

  // Evite qu'un mot générique comme "client", "suivi" ou "équipe" suffise à lui seul.
  if (keywordHits === 1 && multiwordKeywordHits === 0 && overlap < 3) return Math.min(score, 4);

  return score;
}

function firstExplicitMentionPosition(reply: string, template: AutomationTemplate) {
  const normalizedReply = normalizeRecommendationText(reply);
  const title = normalizeRecommendationText(template.title);
  const titleIndex = title ? normalizedReply.indexOf(title) : -1;
  if (titleIndex >= 0) return titleIndex;

  const phrasePositions = template.keywords
    .map((keyword) => normalizeRecommendationText(keyword))
    .filter((keyword) => keyword.includes(" ") && keyword.length >= 6)
    .map((keyword) => normalizedReply.indexOf(keyword))
    .filter((position) => position >= 0);

  return phrasePositions.length > 0 ? Math.min(...phrasePositions) : Number.MAX_SAFE_INTEGER;
}

export function mentionedAutomationTemplateIds(reply: string) {
  const normalizedReply = normalizeRecommendationText(reply);
  if (!normalizedReply) return [];

  const recommendationSignal =
    /\b(recommande|recommandation|priorit|commencerais|regarderais|traiterais|conseille|suggere|devriez|il faut|mettre en place|automatis|gagner du temps|eviter|reduire|ameliorer|suivre|relancer)/.test(
      normalizedReply
    );
  if (!recommendationSignal) return [];

  return AUTOMATION_CATALOG
    .map((template) => ({
      id: template.id,
      score: recommendationScore(reply, template),
      position: firstExplicitMentionPosition(reply, template),
    }))
    .filter((candidate) => candidate.score >= 6)
    .sort((a, b) => a.position - b.position || b.score - a.score)
    .slice(0, 3)
    .map((candidate) => candidate.id);
}

export function explainAutomationRecommendationMatch(reply: string) {
  return AUTOMATION_CATALOG
    .map((template) => ({
      templateId: template.id,
      score: recommendationScore(reply, template),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
}
