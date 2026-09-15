import { AUTOMATION_CATALOG } from "@/lib/automations/catalog";
import { AutomationTemplate, HOURLY_RATE_EUR, KNOWN_TOOLS } from "@/lib/automations/types";
import { assessAdviceMaturity } from "./advice-maturity";
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

function bestDiscoveryQuestion(context: ChatContext) {
  const maturity = assessAdviceMaturity(context);
  const missing = maturity.missingSignals[0];
  if (missing === "objectifs business") return "Quel résultat voulez-vous améliorer en priorité sur les 90 prochains jours : chiffre d'affaires, marge, trésorerie, délai de réponse ou temps dirigeant ?";
  if (missing === "irritants prioritaires") return "Quelles sont les 3 tâches ou situations qui vous coûtent aujourd'hui le plus de temps, de chiffre d'affaires ou de qualité ?";
  if (missing === "données réelles connectées") return "Parmi vos outils actuels, lequel contient le meilleur signal pour mesurer ce problème sur des données réelles ?";
  return "Quel indicateur concret permettrait de dire, dans 30 jours, que cette amélioration a réellement fonctionné ?";
}

function strategicAnswer(context: ChatContext) {
  const maturity = assessAdviceMaturity(context);
  const pain = normalize(context.painPoints ?? "");
  const recommendations: string[] = [];

  if (/prospect|relanc|lead|commercial/.test(pain)) {
    recommendations.push("**Sécuriser les relances commerciales** — c'est le levier à examiner en premier car il touche directement le revenu et le suivi des opportunités.");
  }
  if (/factur|impay|paiement|tresorer/.test(pain)) {
    recommendations.push("**Réduire le délai d'encaissement** — les factures impayées ont un impact direct sur la trésorerie et se prêtent bien à un suivi systématique.");
  }
  if (/compte.?rendu|reunion|appel|meeting/.test(pain)) {
    recommendations.push("**Réduire l'administratif après réunion** — bon candidat pour récupérer du temps sans modifier une décision commerciale sensible.");
  }
  if (recommendations.length === 0 && context.topOpportunity) {
    recommendations.push(`**Examiner ${context.topOpportunity.title}** — c'est l'opportunité actuellement la mieux classée dans Pilotzia, avec un potentiel estimé d'environ ${context.topOpportunity.estimatedHoursPerMonth} h/mois.`);
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "**Revenu** — chercher les ruptures de suivi entre lead, relance, devis et paiement.",
      "**Temps** — repérer les tâches répétées chaque semaine par plusieurs personnes.",
      "**Qualité / délai** — repérer les demandes client qui attendent inutilement une intervention humaine."
    );
  }

  const top = recommendations.slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join("\n");
  const knowledge = maturity.level === "initial"
    ? "Je dispose encore de peu de contexte : ces points sont des hypothèses de consultant, pas un diagnostic de votre entreprise."
    : maturity.level === "contextual"
      ? "Je m'appuie surtout sur votre contexte déclaré. Je peux déjà personnaliser les priorités, mais pas encore mesurer leur fréquence ou leur impact réel."
      : maturity.level === "observed"
        ? "Je dispose de contexte et de premières observations réelles. Je peux commencer à arbitrer avec davantage de confiance, tout en distinguant les faits des estimations."
        : "Le contexte est suffisamment riche pour raisonner de façon opérationnelle et relier les recommandations à des faits structurés.";

  const measured = context.totalHoursSavedThisMonth > 0
    ? `\n\n**Déjà mesuré**\nVos automatisations actives représentent environ ${context.totalHoursSavedThisMonth} h/mois et ${context.totalValueEurThisMonth} € de valeur estimée. Je traiterais ces chiffres comme des indicateurs à confirmer, pas comme du revenu garanti.`
    : "";

  return `**Ma recommandation maintenant**\n${top}\n\n**Pourquoi**\nJe priorise d'abord ce qui combine impact économique, fréquence et capacité à être fiabilisé. Une automatisation n'est intéressante que si elle améliore un processus qui mérite réellement d'être amélioré.\n\n**Niveau de confiance**\n${knowledge}${measured}\n\n**Pour rendre le diagnostic plus pointu**\n${bestDiscoveryQuestion(context)}`;
}

function isAcknowledgement(text: string) {
  return /^(ok|okay|d'accord|dac|oui|compris|vas-y|go|parfait|tres bien|tr[eè]s bien)[.!\s]*$/i.test(text.trim());
}

function continueAfterAcknowledgement(messages: ChatMessageInput[], context: ChatContext): ChatReply {
  const previousAssistant = [...messages.slice(0, -1)].reverse().find((message) => message.role === "assistant")?.content ?? "";
  const question = bestDiscoveryQuestion(context);
  if (/Pour rendre le diagnostic plus pointu|Pour mieux cerner votre besoin/.test(previousAssistant)) {
    return { reply: `Très bien. On passe du conseil général au diagnostic exploitable.\n\n**La donnée qui me manque le plus maintenant**\n${question}` };
  }
  return { reply: `Très bien. Je poursuis sans repartir de zéro.\n\n**Prochaine étape utile**\n${question}` };
}

export function runMockChat(messages: ChatMessageInput[], context: ChatContext): ChatReply {
  const last = messages[messages.length - 1]?.content ?? "";
  const q = normalize(last);

  if (isAcknowledgement(last)) return continueAfterAcknowledgement(messages, context);

  if (isCorrectionRequest(last)) {
    const previousUser = [...messages.slice(0, -1)].reverse().find((message) => message.role === "user")?.content ?? "";
    if (/optimis|gagner plus|plus d'argent|rentabil|marge|priorit/.test(normalize(previousUser))) {
      return { reply: strategicAnswer(context) };
    }
    return {
      reply: `Vous avez raison : la réponse précédente n'était pas assez exploitable.\n\n**Réponse directe**\nJe dois d'abord distinguer ce que Pilotzia sait de votre entreprise de ce qu'il ne fait qu'inférer.\n\n**Pour avancer utilement**\n${bestDiscoveryQuestion(context)}`,
    };
  }

  if (/optimis|gagner plus|plus d'argent|rentabil|marge|priorit|dirige|direction|conseil/.test(q)) {
    return { reply: strategicAnswer(context) };
  }

  if (/(combien|économis|economis|gagné|gagne|valeur|temps gagné)/.test(q)) {
    return {
      reply: `**Ce que je peux mesurer aujourd'hui**\nEnviron ${context.totalHoursSavedThisMonth} h/mois et ${context.totalValueEurThisMonth} € de valeur estimée sur les automatisations actives.\n\n**À interpréter correctement**\nC'est une estimation de temps valorisé, pas une garantie de chiffre d'affaires. Pour parler de ROI, il faut la rapprocher du coût réel, du taux d'usage et d'un indicateur métier avant/après.`,
    };
  }

  if (/(prochaine|quoi automatiser|que faire|opportunit|suivant|ensuite|apr[eè]s)/.test(q)) {
    return { reply: strategicAnswer(context) };
  }

  if (/(score|automation score|note)/.test(q)) {
    return {
      reply: `Votre Automation Score actuel est de ${context.automationScore}/100. Je le traiterais comme un indicateur de progression, pas comme une note de performance de l'entreprise. Ce qui compte est de savoir quelles automatisations améliorent réellement revenu, marge, délai, qualité ou temps disponible.`,
    };
  }

  if (/(ne fonctionne plus|marche plus|erreur|bug|probl[eè]me|panne)/.test(q)) {
    const withIssue = context.automations.find((a) => a.status === "warning" || a.status === "error");
    if (withIssue) {
      return {
        reply: `**Point à traiter en priorité**\n« ${withIssue.name} » nécessite votre attention. Avant de modifier quoi que ce soit, je vérifierais le dernier fonctionnement correct, ce qui a changé depuis, puis l'impact métier de la panne.`,
      };
    }
    return {
      reply: "Je ne vois pas d'automatisation signalée en erreur dans le contexte actuel. Dites-moi laquelle vous inquiète et ce que vous observez ; je raisonnerai à partir des faits disponibles.",
    };
  }

  if (/(outil|utilise|utilisons|connect)/.test(q)) {
    const connected = context.connections.filter((connection) => connection.status === "connected" || connection.status === "active").map((connection) => connection.provider);
    return {
      reply: `**Ce que je connais**\n${context.tools.length ? `Outils déclarés : ${context.tools.join(", ")}.` : "Aucun outil déclaré."}\n${connected.length ? `Sources réellement connectées : ${connected.join(", ")}.` : "Je n'ai pas encore de source réellement connectée à utiliser comme preuve opérationnelle."}\n\nCette distinction est importante : un outil déclaré m'aide à comprendre votre environnement ; une source connectée me permet de raisonner sur des observations réelles.`,
    };
  }

  function describeMatch(match: AutomationTemplate): ChatReply {
    const alreadyInstalled = context.automations.find((a) => normalize(a.name) === normalize(match.title));
    if (alreadyInstalled) {
      return {
        reply: `Vous avez déjà une automatisation proche de ce besoin : « ${alreadyInstalled.name} ». Avant d'en ajouter une autre, je vérifierais son usage, sa fiabilité et l'impact réellement obtenu.`,
      };
    }

    const explicit = isExplicitAutomationRequest(last);
    return {
      reply: explicit
        ? `**Option concrète**\n« ${match.title} » correspond au besoin décrit : ${match.description}\n\n**Estimation**\nPotentiel indicatif : ~${match.estimatedHoursPerMonth} h/mois. Je peux préparer cette opportunité pour validation, mais je ne considérerais pas ce potentiel comme acquis avant d'avoir vérifié votre fréquence réelle et votre processus actuel.`
        : `**Piste à valider**\n« ${match.title} » pourrait être pertinente : ${match.description}\n\nJe ne l'installerais pas sur la seule base d'un mot-clé. Je vérifierais d'abord que le processus existe réellement, qu'il est assez fréquent et que son coût métier justifie l'automatisation.`,
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
      reply: `Merci. Je préfère ne pas forcer une automatisation catalogue si la preuve est insuffisante.\n\n**Ce que je ferais comme consultant**\nJe remonterais d'abord au processus, au résultat attendu et au volume réel.\n\n${bestDiscoveryQuestion(context)}`,
    };
  }

  if (last.trim().length >= 8) {
    const match = findBestCatalogMatch(last, context.tools);
    if (match) return describeMatch(match);

    return {
      reply: `**Première lecture**\nJe peux vous aider sur ce sujet, mais je n'ai pas assez de faits pour donner une recommandation spécifique sans inventer.\n\n${CLARIFY_MARKER} : ${bestDiscoveryQuestion(context)}`,
    };
  }

  return {
    reply: `Je ne vais pas vous faire reformuler pour reformuler. Donnez-moi simplement la décision ou le problème métier à traiter ; je distinguerai ce que je sais, ce que j'estime et ce qu'il faut vérifier.`,
  };
}
