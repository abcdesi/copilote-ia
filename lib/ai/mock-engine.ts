import { AUTOMATION_CATALOG } from "@/lib/automations/catalog";
import { HOURLY_RATE_EUR, KNOWN_TOOLS } from "@/lib/automations/types";
import { ChatContext, ChatMessageInput, DiagnosticResult } from "./types";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function detectTools(input: string): string[] {
  const normalized = normalize(input);
  return KNOWN_TOOLS.filter((tool) => normalized.includes(normalize(tool)));
}

/**
 * Moteur de diagnostic mock : pattern-matching déterministe sur le texte saisi
 * (mots-clés + outils cités) contre le catalogue d'automatisations. Pas d'appel
 * réseau — permet de faire fonctionner tout le produit sans clé API configurée.
 */
export function runMockDiagnostic(input: string, existingTools: string[] = []): DiagnosticResult {
  const normalized = normalize(input);
  const detectedTools = Array.from(new Set([...detectTools(input), ...existingTools]));

  const scored = AUTOMATION_CATALOG.map((template) => {
    let score = 0;
    for (const keyword of template.keywords) {
      if (normalized.includes(normalize(keyword))) score += 3;
    }
    for (const tool of template.relevantTools) {
      if (detectedTools.includes(tool)) score += 1;
    }
    return { template, score };
  });

  scored.sort((a, b) => b.score - a.score);

  let matched = scored.filter((s) => s.score > 0);
  // Si rien ne matche vraiment (texte très court/vague), on propose quand même
  // les automatisations les plus universellement utiles plutôt qu'un résultat vide.
  if (matched.length < 3) {
    const fallbackIds = ["relance-prospects", "compte-rendu-reunion", "reporting-hebdo", "notification-leads"];
    matched = AUTOMATION_CATALOG.filter((t) => fallbackIds.includes(t.id)).map((template) => ({
      template,
      score: 1,
    }));
  }

  const top = matched.slice(0, 4);

  const opportunities = top.map(({ template }) => ({
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

  const potentialHoursPerMonth = opportunities.reduce((sum, o) => sum + o.estimatedHoursPerMonth, 0);
  const potentialValueEur = opportunities.reduce((sum, o) => sum + o.estimatedValueEur, 0);

  // Score composite : base + bonus par opportunité à fort impact détectée + bonus outils connectés,
  // plafonné pour rester crédible (jamais 0, jamais 100 avant d'avoir de vraies automatisations actives).
  const impactBonus = opportunities.filter((o) => o.impactLevel === "high").length * 8;
  const toolsBonus = Math.min(detectedTools.length * 3, 15);
  const automationScore = Math.max(35, Math.min(78, 42 + impactBonus + toolsBonus));

  const summary =
    opportunities.length > 0
      ? `Nous avons identifié ${opportunities.length} opportunités concrètes, pour un potentiel estimé de ${potentialHoursPerMonth} h par mois.`
      : "Décrivez votre activité et vos outils pour une analyse plus précise.";

  return {
    automationScore,
    detectedTools,
    opportunities,
    potentialHoursPerMonth,
    potentialValueEur,
    summary,
  };
}

const CHAT_FALLBACKS = [
  "Je n'ai pas assez d'éléments pour répondre précisément — pouvez-vous préciser votre demande ?",
  "Pouvez-vous reformuler ? Je peux vous aider sur vos automatisations, vos opportunités ou les résultats obtenus.",
];

/**
 * Copilote mock : réponses contextualisées par pattern-matching sur l'intention
 * du message (économies réalisées, prochaine opportunité, outils, problème sur une automatisation...).
 * Même interface que l'adaptateur Claude réel (voir lib/ai/index.ts) pour un remplacement transparent.
 */
export function runMockChat(messages: ChatMessageInput[], context: ChatContext): string {
  const last = messages[messages.length - 1]?.content ?? "";
  const q = normalize(last);

  if (/(combien|économis|economis|gagné|gagne|valeur|temps gagné)/.test(q)) {
    return `Ce mois-ci, ${context.companyName} a économisé environ ${context.totalHoursSavedThisMonth} h grâce à vos automatisations actives, soit une valeur estimée à ${context.totalValueEurThisMonth} €. Ce sont des estimations basées sur le temps habituellement consacré à ces tâches.`;
  }

  if (/(prochaine|quoi automatiser|que faire|opportunit|suivant|ensuite|apr[eè]s)/.test(q)) {
    if (context.topOpportunity) {
      return `Je recommande de regarder « ${context.topOpportunity.title} » : le potentiel estimé est d'environ ${context.topOpportunity.estimatedHoursPerMonth} h/mois. Vous pouvez la retrouver dans l'onglet Opportunités.`;
    }
    return "Je n'ai pas encore identifié de nouvelle opportunité forte — vos automatisations actuelles couvrent bien vos besoins connus. Dites-m'en plus sur une tâche répétitive et je regarde ce qui est possible.";
  }

  if (/(score|automation score|note)/.test(q)) {
    return `Votre Automation Score actuel est de ${context.automationScore}/100. Il reflète la part de vos tâches répétitives déjà automatisées et leur fiabilité. Installer une nouvelle automatisation ou améliorer une automatisation existante le fait progresser.`;
  }

  if (/(ne fonctionne plus|marche plus|erreur|bug|probl[eè]me|panne)/.test(q)) {
    const withIssue = context.automations.find((a) => a.status === "warning" || a.status === "error");
    if (withIssue) {
      return `Je vois que « ${withIssue.name} » nécessite votre attention. Vous pouvez consulter le détail et l'historique dans l'onglet Automatisations pour voir ce qui a changé.`;
    }
    return "Toutes vos automatisations semblent fonctionner normalement actuellement. Pouvez-vous préciser laquelle vous inquiète ?";
  }

  if (/(outil|utilise|utilisons|connect)/.test(q)) {
    return context.tools.length
      ? `Vos outils actuellement connus : ${context.tools.join(", ")}. Si vous en changez, dites-le-moi et j'adapte mes recommandations.`
      : "Je ne connais pas encore vos outils. Vous pouvez les ajouter dans l'onglet Outils ou me les indiquer directement ici.";
  }

  if (/(automatiser|automatise|automatisation)/.test(q)) {
    return `Je peux analyser ce besoin pour ${context.companyName}. Décrivez la tâche précise qui vous fait perdre du temps et je vous proposerai la meilleure automatisation possible, sans que vous ayez à choisir d'outil technique.`;
  }

  return CHAT_FALLBACKS[last.length % CHAT_FALLBACKS.length];
}
