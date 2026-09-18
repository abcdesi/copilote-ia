import { AUTOMATION_CATALOG } from "@/lib/automations/catalog";

function normalizeRecommendationText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mentionedAutomationTemplateIds(reply: string) {
  const normalizedReply = normalizeRecommendationText(reply);
  if (!normalizedReply) return [];

  const recommendationSignal =
    /\b(recommande|recommandation|priorit|commencerais|regarderais|traiterais|conseille|suggere|devriez|il faut|mettre en place|automatis)/.test(
      normalizedReply
    );
  if (!recommendationSignal) return [];

  return AUTOMATION_CATALOG
    .filter((template) => {
      const title = normalizeRecommendationText(template.title);
      return title.length >= 8 && normalizedReply.includes(title);
    })
    .slice(0, 3)
    .map((template) => template.id);
}
