import { AUTOMATION_CATALOG } from "@/lib/automations/catalog";
import { AutomationTemplate, HOURLY_RATE_EUR, KNOWN_TOOLS } from "@/lib/automations/types";
import { ChatContext, ChatMessageInput, ChatReply, DiagnosticResult } from "./types";

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

function scoreCatalog(input: string, existingTools: string[] = []) {
  const normalized = normalize(input);
  const detectedTools = Array.from(new Set([...detectTools(input), ...existingTools]));

  const scored = AUTOMATION_CATALOG.map((template) => {
    let keywordScore = 0;
    for (const keyword of template.keywords) {
      if (normalized.includes(normalize(keyword))) keywordScore += 3;
    }
    let toolScore = 0;
    for (const tool of template.relevantTools) {
      if (detectedTools.includes(tool)) toolScore += 1;
    }
    return { template, keywordScore, toolScore, score: keywordScore + toolScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return { scored, detectedTools };
}

/**
 * Trouve la meilleure correspondance catalogue pour un besoin décrit en texte libre
 * (utilisé par le copilote conversationnel). Exige au moins un vrai mot-clé du besoin —
 * un simple recoupement d'outils utilisés ne suffit pas à qualifier une correspondance
 * (sinon n'importe quelle phrase peut « matcher » un template au hasard via les outils
 * déjà connus de l'entreprise). Retourne `null` si rien ne matche suffisamment — mieux
 * vaut l'admettre honnêtement que proposer une automatisation hors sujet.
 */
export function findBestCatalogMatch(input: string, existingTools: string[] = []): AutomationTemplate | null {
  const { scored } = scoreCatalog(input, existingTools);
  const best = scored.find((s) => s.keywordScore > 0);
  return best ? best.template : null;
}

/**
 * Moteur de diagnostic mock : pattern-matching déterministe sur le texte saisi
 * (mots-clés + outils cités) contre le catalogue d'automatisations. Pas d'appel
 * réseau — permet de faire fonctionner tout le produit sans clé API configurée.
 */
export function runMockDiagnostic(input: string, existingTools: string[] = []): DiagnosticResult {
  const { scored, detectedTools } = scoreCatalog(input, existingTools);

  let matched = scored.filter((s) => s.score > 0);
  // Si rien ne matche vraiment (texte très court/vague), on propose quand même
  // les automatisations les plus universellement utiles plutôt qu'un résultat vide.
  if (matched.length < 3) {
    const fallbackIds = ["relance-prospects", "compte-rendu-reunion", "reporting-hebdo", "notification-leads"];
    matched = AUTOMATION_CATALOG.filter((t) => fallbackIds.includes(t.id)).map((template) => ({
      template,
      keywordScore: 0,
      toolScore: 0,
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

// Sous-chaîne fixe présente dans notre question de clarification, pour la reconnaître
// au tour suivant et savoir que la réponse de l'utilisateur s'y rapporte.
const CLARIFY_MARKER = "Pour mieux cerner votre besoin";

/**
 * Copilote mock : réponses contextualisées par pattern-matching sur l'intention
 * du message (économies réalisées, prochaine opportunité, outils, problème sur une automatisation...).
 * Même interface que l'adaptateur Claude réel (voir lib/ai/index.ts) pour un remplacement transparent.
 */
export function runMockChat(messages: ChatMessageInput[], context: ChatContext): ChatReply {
  const last = messages[messages.length - 1]?.content ?? "";
  const q = normalize(last);

  if (/(combien|économis|economis|gagné|gagne|valeur|temps gagné)/.test(q)) {
    return {
      reply: `Ce mois-ci, ${context.companyName} a économisé environ ${context.totalHoursSavedThisMonth} h grâce à vos automatisations actives, soit une valeur estimée à ${context.totalValueEurThisMonth} €. Ce sont des estimations basées sur le temps habituellement consacré à ces tâches.`,
    };
  }

  if (/(prochaine|quoi automatiser|que faire|opportunit|suivant|ensuite|apr[eè]s)/.test(q)) {
    if (context.topOpportunity) {
      return {
        reply: `Je recommande de regarder « ${context.topOpportunity.title} » : le potentiel estimé est d'environ ${context.topOpportunity.estimatedHoursPerMonth} h/mois. Vous pouvez la retrouver dans l'onglet Opportunités.`,
      };
    }
    return {
      reply:
        "Je n'ai pas encore identifié de nouvelle opportunité forte — vos automatisations actuelles couvrent bien vos besoins connus. Dites-m'en plus sur une tâche répétitive et je regarde ce qui est possible.",
    };
  }

  if (/(score|automation score|note)/.test(q)) {
    return {
      reply: `Votre Automation Score actuel est de ${context.automationScore}/100. Il reflète la part de vos tâches répétitives déjà automatisées et leur fiabilité. Installer une nouvelle automatisation ou améliorer une automatisation existante le fait progresser.`,
    };
  }

  if (/(ne fonctionne plus|marche plus|erreur|bug|probl[eè]me|panne)/.test(q)) {
    const withIssue = context.automations.find((a) => a.status === "warning" || a.status === "error");
    if (withIssue) {
      return {
        reply: `Je vois que « ${withIssue.name} » nécessite votre attention. Vous pouvez consulter le détail et l'historique dans l'onglet Automatisations pour voir ce qui a changé.`,
      };
    }
    return {
      reply: "Toutes vos automatisations semblent fonctionner normalement actuellement. Pouvez-vous préciser laquelle vous inquiète ?",
    };
  }

  if (/(outil|utilise|utilisons|connect)/.test(q)) {
    return {
      reply: context.tools.length
        ? `Vos outils actuellement connus : ${context.tools.join(", ")}. Si vous en changez, dites-le-moi et j'adapte mes recommandations.`
        : "Je ne connais pas encore vos outils. Vous pouvez les ajouter dans l'onglet Outils ou me les indiquer directement ici.",
    };
  }

  function describeMatch(match: AutomationTemplate): ChatReply {
    const alreadyInstalled = context.automations.find((a) => normalize(a.name) === normalize(match.title));
    if (alreadyInstalled) {
      return {
        reply: `Vous avez déjà une automatisation proche de ce besoin : « ${alreadyInstalled.name} », actuellement ${alreadyInstalled.status === "active" ? "active" : "installée"}. Vous pouvez la consulter dans l'onglet Automatisations.`,
      };
    }
    return {
      reply: `Ce besoin correspond à « ${match.title} » : ${match.description} Potentiel estimé ~${match.estimatedHoursPerMonth} h/mois. Je l'ajoute à vos opportunités.`,
      matchedTemplateId: match.id,
    };
  }

  // Si le message précédent était notre question de clarification, on combine la description
  // d'origine avec cette réponse et on retente une correspondance — plutôt que de reposer
  // la même question ou d'abandonner après un seul essai.
  const prevAssistant = messages[messages.length - 2];
  const prevUser = messages[messages.length - 3];
  if (prevAssistant?.role === "assistant" && prevAssistant.content.includes(CLARIFY_MARKER) && prevUser?.role === "user") {
    const combined = `${prevUser.content}. ${last}`;
    const match = findBestCatalogMatch(combined, context.tools);
    if (match) return describeMatch(match);
    return {
      reply:
        "Merci pour ces précisions. Je ne trouve toujours pas d'automatisation prête pour ce besoin précis dans notre catalogue actuel, mais c'est noté avec ces détails — ça aide à prioriser les prochaines automatisations. En attendant, je peux vous aider sur vos automatisations existantes, vos opportunités ou vos résultats.",
    };
  }

  // Au-delà des intentions ci-dessus, on considère le message comme la description d'un
  // besoin métier et on le confronte au catalogue — plutôt qu'une boucle "reformulez"
  // qui ne mène nulle part quand le texte ne matche aucune règle simple.
  if (last.trim().length >= 8) {
    const match = findBestCatalogMatch(last, context.tools);
    if (match) return describeMatch(match);

    return {
      reply: `Je ne trouve pas encore de correspondance exacte dans notre catalogue. ${CLARIFY_MARKER} : quel outil utilisez-vous aujourd'hui pour cette tâche (tableur, logiciel dédié, autre) ? Et qu'aimeriez-vous voir automatisé en premier — une alerte, un suivi, un rapport, autre chose ?`,
    };
  }

  return {
    reply: "Pouvez-vous préciser ? Je peux vous aider sur vos automatisations, vos opportunités ou les résultats obtenus.",
  };
}
