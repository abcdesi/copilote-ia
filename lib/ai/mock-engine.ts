import { AUTOMATION_CATALOG } from "@/lib/automations/catalog";
import { AutomationTemplate, HOURLY_RATE_EUR, KNOWN_TOOLS } from "@/lib/automations/types";
import { findConfidentTemplateMatch, isCorrectionRequest, isExplicitAutomationRequest } from "./advisor-policy";
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

export function findBestCatalogMatch(input: string, existingTools: string[] = []): AutomationTemplate | null {
  return findConfidentTemplateMatch(input, AUTOMATION_CATALOG, existingTools) ?? null;
}

export function runMockDiagnostic(input: string, existingTools: string[] = []): DiagnosticResult {
  const { scored, detectedTools } = scoreCatalog(input, existingTools);

  let matched = scored.filter((s) => s.score > 0);
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

const CLARIFY_MARKER = "Pour mieux cerner votre besoin";

function strategicAnswer(context: ChatContext) {
  const priorities: string[] = [];

  if (context.topOpportunity) {
    priorities.push(`1. **${context.topOpportunity.title}** — potentiel estimé d'environ ${context.topOpportunity.estimatedHoursPerMonth} h/mois.`);
  }
  if (context.painPoints) {
    priorities.push(`2. **Vos irritants déclarés** — ${context.painPoints}. Je chercherais d'abord les tâches fréquentes, manuelles et directement liées au revenu ou à la satisfaction client.`);
  }
  if (context.objectives) {
    priorities.push(`3. **Vos objectifs business** — ${context.objectives}. Toute automatisation devrait être priorisée selon son effet sur le revenu, la marge, le délai de réponse ou le temps dirigeant.`);
  }

  if (priorities.length === 0) {
    priorities.push(
      "1. **Ventes** — relances, qualification et devis : priorité si le manque de suivi fait perdre du chiffre d'affaires.",
      "2. **Opérations** — tâches répétitives à forte fréquence : priorité si elles consomment du temps chaque semaine.",
      "3. **Support / fidélisation** — suivi client et satisfaction : priorité si cela réduit le churn ou améliore la réactivité."
    );
  }

  return `Pour optimiser votre temps **et** gagner plus d'argent, je prioriserais les leviers qui combinent impact revenu et temps économisé.\n\n${priorities.join("\n")}\n\nAujourd'hui, vos automatisations actives représentent environ ${context.totalHoursSavedThisMonth} h économisées ce mois-ci, soit ${context.totalValueEurThisMonth} € de valeur estimée. Ce sont des estimations, pas une garantie de revenu.\n\nMa prochaine étape recommandée : classer vos tâches actuelles selon **impact revenu × temps consommé × facilité d'automatisation**, puis traiter les 1 à 3 meilleures.`;
}

export function runMockChat(messages: ChatMessageInput[], context: ChatContext): ChatReply {
  const last = messages[messages.length - 1]?.content ?? "";
  const q = normalize(last);

  if (isCorrectionRequest(last)) {
    const previousUser = [...messages.slice(0, -1)].reverse().find((message) => message.role === "user")?.content ?? "";
    if (/optimis|gagner plus|plus d'argent|rentabil|marge|priorit/.test(normalize(previousUser))) {
      return { reply: strategicAnswer(context) };
    }
    return {
      reply: "Vous avez raison : ma réponse précédente n'était pas assez directe. Reformulez votre objectif en une phrase et je répondrai d'abord à la question, puis seulement ensuite je proposerai une action si elle est réellement pertinente.",
    };
  }

  if (/optimis|gagner plus|plus d'argent|rentabil|marge|priorit/.test(q)) {
    return { reply: strategicAnswer(context) };
  }

  if (/(combien|économis|economis|gagné|gagne|valeur|temps gagné)/.test(q)) {
    return {
      reply: `Ce mois-ci, ${context.companyName} a économisé environ ${context.totalHoursSavedThisMonth} h grâce à vos automatisations actives, soit une valeur estimée à ${context.totalValueEurThisMonth} €. Ce sont des estimations basées sur le temps habituellement consacré à ces tâches.`,
    };
  }

  if (/(prochaine|quoi automatiser|que faire|opportunit|suivant|ensuite|apr[eè]s)/.test(q)) {
    if (context.topOpportunity) {
      return {
        reply: `Je recommande de regarder « ${context.topOpportunity.title} » : le potentiel estimé est d'environ ${context.topOpportunity.estimatedHoursPerMonth} h/mois. Je la prioriserais seulement si elle est cohérente avec votre objectif business actuel et vos tâches réellement manuelles.`,
      };
    }
    return {
      reply:
        "Je n'ai pas encore assez de données pour recommander une priorité avec confiance. Donnez-moi les 3 tâches qui vous prennent le plus de temps ou qui ralentissent le chiffre d'affaires, et je les classerai par impact.",
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

    const explicit = isExplicitAutomationRequest(last);
    return {
      reply: explicit
        ? `Ce besoin correspond à « ${match.title} » : ${match.description} Potentiel estimé ~${match.estimatedHoursPerMonth} h/mois. Je peux préparer cette opportunité pour validation.`
        : `Une piste pertinente est « ${match.title} » : ${match.description} Potentiel estimé ~${match.estimatedHoursPerMonth} h/mois. Je vous la recommande seulement si elle correspond bien à votre processus réel.`,
      ...(explicit ? { matchedTemplateId: match.id } : {}),
    };
  }

  const prevAssistant = messages[messages.length - 2];
  const prevUser = messages[messages.length - 3];
  if (prevAssistant?.role === "assistant" && prevAssistant.content.includes(CLARIFY_MARKER) && prevUser?.role === "user") {
    const combined = `${prevUser.content}. ${last}`;
    const match = findBestCatalogMatch(combined, context.tools);
    if (match) return describeMatch(match);
    return {
      reply:
        "Merci pour ces précisions. Je n'ai pas assez de preuves pour rattacher ce besoin à une automatisation du catalogue sans risque de hors-sujet. Je peux toutefois analyser le processus et vous dire où se situe le meilleur levier métier.",
    };
  }

  if (last.trim().length >= 8) {
    const match = findBestCatalogMatch(last, context.tools);
    if (match) return describeMatch(match);

    return {
      reply: `Je n'ai pas assez d'éléments pour recommander une automatisation précise sans inventer. ${CLARIFY_MARKER} : quel résultat voulez-vous améliorer en priorité — revenu, marge, temps, délai de réponse ou qualité — et quelle tâche vous bloque aujourd'hui ?`,
    };
  }

  return {
    reply: "Pouvez-vous préciser votre objectif ? Je peux vous aider à prioriser selon revenu, temps, risque et effort.",
  };
}
