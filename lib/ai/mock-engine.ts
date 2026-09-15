import { AUTOMATION_CATALOG } from "@/lib/automations/catalog";
import { AutomationTemplate, HOURLY_RATE_EUR, KNOWN_TOOLS } from "@/lib/automations/types";
import { assessAdviceMaturity } from "./advice-maturity";
import {
  findConfidentTemplateMatch,
  isCorrectionRequest,
  isExplicitAutomationRequest,
  scoreTemplateIntent,
} from "./advisor-policy";
import { ChatContext, ChatMessageInput, ChatReply, DiagnosticResult } from "./types";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function detectTools(input: string): string[] {
  const normalized = normalize(input);
  return KNOWN_TOOLS.filter((tool) => normalized.includes(normalize(tool)));
}

function scoreCatalog(input: string, existingTools: string[] = []) {
  const detectedTools = Array.from(new Set([...detectTools(input), ...existingTools]));
  const scored = AUTOMATION_CATALOG.map((template) => ({
    template,
    ...scoreTemplateIntent(input, template, detectedTools),
  })).sort((a, b) => b.score - a.score);

  return { scored, detectedTools };
}

export function findBestCatalogMatch(input: string, existingTools: string[] = []): AutomationTemplate | null {
  return findConfidentTemplateMatch(input, AUTOMATION_CATALOG, existingTools) ?? null;
}

export function runMockDiagnostic(input: string, existingTools: string[] = []): DiagnosticResult {
  const { scored, detectedTools } = scoreCatalog(input, existingTools);
  const credible = scored.filter(
    (candidate) => candidate.strongMatches >= 2 || candidate.keywordScore >= 2.5
  );
  const bestScore = credible[0]?.score ?? 0;
  const top = credible
    .filter((candidate) => candidate.score >= Math.max(2.5, bestScore - 1))
    .slice(0, 3);

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

  const potentialHoursPerMonth = opportunities.reduce((sum, opportunity) => sum + opportunity.estimatedHoursPerMonth, 0);
  const potentialValueEur = opportunities.reduce((sum, opportunity) => sum + opportunity.estimatedValueEur, 0);
  const inputRichness = Math.min(25, Math.floor(input.trim().length / 24) * 4);
  const toolsEvidence = Math.min(20, detectedTools.length * 5);
  const automationScore = Math.min(70, 20 + inputRichness + toolsEvidence);

  const summary = opportunities.length === 1
    ? `Une priorité ressort clairement : ${opportunities[0].title}. L'estimation reste à confirmer avec vos volumes et vos outils réels.`
    : opportunities.length > 1
      ? `${opportunities.length} pistes liées à votre demande ressortent. Elles doivent encore être classées avec vos volumes et votre processus réel.`
      : "Votre besoin est compréhensible, mais il manque encore assez de contexte pour recommander une automatisation précise sans inventer.";

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

type BusinessObjective = "response_time" | "time" | "revenue" | "margin" | "cash";

function inferObjective(text: string): BusinessObjective | null {
  const value = normalize(text);
  if (/delai de reponse|temps de reponse|repondre plus vite|rapidite de reponse/.test(value)) return "response_time";
  if (/tresorer|cash|encaissement|impaye/.test(value)) return "cash";
  if (/marge|rentabil|profit/.test(value)) return "margin";
  if (/chiffre d['’]?affaires|revenu|vente|commercial/.test(value)) return "revenue";
  if (/gagner du temps|economiser du temps|perdre du temps|temps dirigeant|productiv|optimis.*temps/.test(value)) return "time";
  return null;
}

function latestObjective(messages: ChatMessageInput[], context: ChatContext): BusinessObjective | null {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    const objective = inferObjective(message.content);
    if (objective) return objective;
  }
  return inferObjective(context.objectives ?? "");
}

function bestDiscoveryQuestion(context: ChatContext, messages: ChatMessageInput[] = []) {
  const objective = latestObjective(messages, context);
  const transcript = normalize(
    messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join(" ")
  );

  if (objective === "response_time") {
    if (/nouveau prospect|nouveaux prospects|lead entrant|lead entrant/.test(transcript)) {
      return "Quel est aujourd'hui votre délai moyen de première réponse à un nouveau prospect, et quel délai cible voulez-vous atteindre ?";
    }
    if (/client|support|sav/.test(transcript)) {
      return "Quel est aujourd'hui votre délai moyen de première réponse client, et sur quel canal se crée l'attente principale ?";
    }
    if (/relance|prospect.*repond|prospect.*silence/.test(transcript)) {
      return "Après combien de jours sans réponse relancez-vous un prospect aujourd'hui, et combien de prospects sont concernés chaque mois ?";
    }
    return "Quand vous dites « délai de réponse », parlez-vous surtout des nouveaux prospects, des clients/support, ou du délai avant de relancer un prospect silencieux ?";
  }

  if (objective === "time") {
    return "Parmi vos tâches répétitives, laquelle consomme le plus d'heures par semaine aujourd'hui ? Donnez-moi simplement la tâche et un ordre de grandeur.";
  }
  if (objective === "revenue") {
    return "À quelle étape perdez-vous le plus d'opportunités aujourd'hui : réponse initiale, relance, devis, closing ou réactivation ?";
  }
  if (objective === "margin") {
    return "Quelle dépense ou quel processus a le plus augmenté sans progression équivalente de valeur ou de chiffre d'affaires ?";
  }
  if (objective === "cash") {
    return "Quel est aujourd'hui votre principal point de tension de trésorerie : retards clients, facturation tardive, stock ou calendrier de décaissement ?";
  }

  const maturity = assessAdviceMaturity(context);
  const missing = maturity.missingSignals[0];
  if (missing === "objectifs business") return "Quel résultat voulez-vous améliorer en priorité sur les 90 prochains jours : chiffre d'affaires, marge, trésorerie, délai de réponse ou temps dirigeant ?";
  if (missing === "irritants prioritaires") return "Quelles sont les 3 tâches ou situations qui vous coûtent aujourd'hui le plus de temps, de chiffre d'affaires ou de qualité ?";
  if (missing === "données réelles connectées") return "Parmi vos outils actuels, lequel contient le meilleur signal pour mesurer ce problème sur des données réelles ?";
  return "Quel indicateur concret permettrait de dire, dans 30 jours, que cette amélioration a réellement fonctionné ?";
}

function timeOptimizationAnswer(context: ChatContext) {
  const pain = normalize(context.painPoints ?? "");
  const priorities: string[] = [];

  if (/compte.?rendu|reunion|appel|meeting/.test(pain)) {
    priorities.push("**Comptes-rendus et suivi après réunion** — c'est souvent le gain de temps le plus rapide : tâche répétitive, structurée et à faible risque métier.");
  }
  if (/prospect|relanc|lead|commercial/.test(pain)) {
    priorities.push("**Relances prospects** — forte répétition et impact commercial. J'automatiserais surtout la détection, la préparation et le timing, avec contrôle humain sur les cas sensibles.");
  }
  if (/factur|impay|paiement|tresorer/.test(pain)) {
    priorities.push("**Relances de factures** — gain de temps administratif plus effet trésorerie. C'est un bon candidat si le volume d'impayés est récurrent.");
  }

  if (priorities.length === 0 && context.topOpportunity) {
    priorities.push(`**${context.topOpportunity.title}** — c'est la piste aujourd'hui la mieux classée dans Pilotzia. Je la validerais toutefois avec votre volume réel avant de promettre un gain.`);
  }
  if (priorities.length === 0) {
    priorities.push(
      "**Administration récurrente** — reporting, comptes-rendus, saisies et transferts d'information.",
      "**Suivi commercial** — relances, qualification et rappels qui reposent encore sur la mémoire humaine.",
      "**Suivi financier** — facturation, relances et rapprochements répétitifs."
    );
  }

  const ranked = priorities.slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join("\n");
  const evidence = context.painPoints
    ? "Je m'appuie ici sur les irritants que vous avez déjà déclarés, pas sur une moyenne générique."
    : "Je n'ai pas encore assez de faits pour classer ces pistes proprement : ce sont des hypothèses de départ.";
  const existing = context.totalHoursSavedThisMonth > 0
    ? `\n\n**À ne pas confondre**\nLes ${context.totalHoursSavedThisMonth} h/mois déjà estimées correspondent à ce que vos automatisations actuelles économisent déjà. Ce chiffre ne répond pas à la question « où gagner davantage de temps ». `
    : "";

  return `**Là où je chercherais du temps en premier**\n${ranked}\n\n**Base de cette recommandation**\n${evidence}${existing}\n\n**Pour les classer sérieusement**\nParmi ces tâches, laquelle vous prend aujourd'hui le plus d'heures par semaine ?`;
}

function responseTimeAnswer(context: ChatContext, messages: ChatMessageInput[]) {
  const pain = normalize(context.painPoints ?? "");
  const commercialSignal = /prospect|relanc|lead|commercial/.test(pain);
  const hypothesis = commercialSignal
    ? "Votre contexte fait déjà ressortir un problème de suivi commercial. Je commencerais donc par vérifier le délai de réponse et de relance côté prospects."
    : "Je retiens bien votre objectif : réduire le délai de réponse. Je ne vais pas vous reposer la même question.";

  return `**Objectif retenu : réduire le délai de réponse**\n${hypothesis}\n\n**Point important**\nIl faut distinguer trois problèmes différents : répondre plus vite à un nouveau prospect, répondre plus vite à un client, ou relancer plus vite quand quelqu'un ne répond plus. Les solutions et les métriques ne sont pas les mêmes.\n\n**Prochaine précision utile**\n${bestDiscoveryQuestion(context, messages)}`;
}

function objectiveSelectionAnswer(objective: BusinessObjective, context: ChatContext, messages: ChatMessageInput[]): ChatReply {
  if (objective === "response_time") return { reply: responseTimeAnswer(context, messages) };
  if (objective === "time") return { reply: timeOptimizationAnswer(context) };
  if (objective === "cash") {
    const pain = normalize(context.painPoints ?? "");
    const start = /factur|impay|paiement/.test(pain)
      ? "Votre contexte pointe déjà les relances de factures : je commencerais par mesurer les créances échues, leur ancienneté et le temps passé à relancer."
      : "Je commencerais par localiser précisément où le cash se bloque avant de recommander une automatisation.";
    return { reply: `**Objectif retenu : trésorerie**\n${start}\n\n**Prochaine précision utile**\n${bestDiscoveryQuestion(context, messages)}` };
  }
  if (objective === "margin") {
    return { reply: `**Objectif retenu : marge**\nJe chercherais d'abord les coûts qui progressent plus vite que la valeur produite, puis les tâches humaines répétitives qui peuvent être standardisées sans dégrader la qualité.\n\n**Prochaine précision utile**\n${bestDiscoveryQuestion(context, messages)}` };
  }
  return { reply: `**Objectif retenu : chiffre d'affaires**\nJe chercherais d'abord les fuites du parcours commercial avant d'ajouter des automatisations : délai de réponse, relances oubliées, devis non suivis et opportunités qui stagnent.\n\n**Prochaine précision utile**\n${bestDiscoveryQuestion(context, messages)}` };
}

function strategicAnswer(context: ChatContext, messages: ChatMessageInput[] = []) {
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

  return `**Ma recommandation maintenant**\n${top}\n\n**Pourquoi**\nJe priorise ce qui combine impact économique, fréquence et capacité à être fiabilisé.\n\n**Niveau de confiance**\n${knowledge}\n\n**Prochaine décision utile**\n${bestDiscoveryQuestion(context, messages)}`;
}

function isAcknowledgement(text: string) {
  return /^(ok|okay|d'accord|dac|oui|compris|vas-y|go|parfait|tres bien|tr[eè]s bien)[.!\s]*$/i.test(text.trim());
}

function previousSubstantiveUser(messages: ChatMessageInput[]) {
  return [...messages.slice(0, -1)].reverse().find(
    (message) => message.role === "user" && !isAcknowledgement(message.content) && !isCorrectionRequest(message.content)
  )?.content ?? "";
}

function continueAfterAcknowledgement(messages: ChatMessageInput[], context: ChatContext): ChatReply {
  const objective = latestObjective(messages, context);
  if (objective) return objectiveSelectionAnswer(objective, context, messages);
  return {
    reply: `Très bien. Je poursuis sans repartir de zéro.\n\n**Prochaine information utile**\n${bestDiscoveryQuestion(context, messages)}`,
  };
}

function isTimeOptimizationQuestion(text: string) {
  const value = normalize(text);
  return /gagner du temps|economiser du temps|ou.*gagner.*temps|ou.*perd.*temps|optimis.*temps|temps.*optimis/.test(value);
}

function isMeasurementQuestion(text: string) {
  const value = normalize(text);
  return /combien.*(heure|temps|euro)|temps economis|heures economis|valeur estime|gain actuel|roi|retour sur investissement/.test(value);
}

export function runMockChat(messages: ChatMessageInput[], context: ChatContext): ChatReply {
  const last = messages[messages.length - 1]?.content ?? "";
  const q = normalize(last);

  if (isAcknowledgement(last)) return continueAfterAcknowledgement(messages, context);

  if (isCorrectionRequest(last)) {
    const previousUser = previousSubstantiveUser(messages);
    if (isTimeOptimizationQuestion(previousUser)) return { reply: timeOptimizationAnswer(context) };
    const previousObjective = inferObjective(previousUser);
    if (previousObjective) return objectiveSelectionAnswer(previousObjective, context, messages);
    if (/optimis|gagner plus|plus d'argent|rentabil|marge|priorit/.test(normalize(previousUser))) {
      return { reply: strategicAnswer(context, messages) };
    }
    return {
      reply: `Vous avez raison : je n'ai pas été assez clair.\n\n**En version simple**\nJe dois répondre à votre problème avant de vous demander davantage d'informations. Dites-moi le résultat que vous voulez obtenir ; je vous donnerai d'abord une recommandation, puis seulement la donnée qui manque pour la rendre plus précise.`,
    };
  }

  if (isTimeOptimizationQuestion(last)) {
    return { reply: timeOptimizationAnswer(context) };
  }

  const directObjective = inferObjective(last);
  if (directObjective && last.trim().length <= 90) {
    return objectiveSelectionAnswer(directObjective, context, messages);
  }

  if (/optimis|gagner plus|plus d'argent|rentabil|marge|priorit|dirige|direction|conseil/.test(q)) {
    return { reply: strategicAnswer(context, messages) };
  }

  if (isMeasurementQuestion(last)) {
    return {
      reply: `**Ce qui est déjà estimé**\nVos automatisations actives représentent environ ${context.totalHoursSavedThisMonth} h/mois et ${context.totalValueEurThisMonth} € de valeur de temps.\n\n**Ce que ce chiffre signifie**\nC'est une estimation du temps déjà récupéré, pas une réponse à la question « où dois-je encore optimiser ? » et pas une garantie de chiffre d'affaires.`,
    };
  }

  if (/(prochaine|quoi automatiser|que faire|opportunit|suivant|ensuite|apr[eè]s)/.test(q)) {
    return { reply: strategicAnswer(context, messages) };
  }

  if (/(score|automation score|note)/.test(q)) {
    return {
      reply: `Votre Automation Score actuel est de ${context.automationScore}/100. Je le traite comme un indicateur de progression, pas comme une note de performance de l'entreprise. La priorité reste l'impact réel sur revenu, marge, délai, qualité et temps disponible.`,
    };
  }

  if (/(ne fonctionne plus|marche plus|erreur|bug|probl[eè]me|panne)/.test(q)) {
    const withIssue = context.automations.find((automation) => automation.status === "warning" || automation.status === "error");
    if (withIssue) {
      return {
        reply: `**Point à traiter en priorité**\n« ${withIssue.name} » nécessite votre attention. Je vérifierais le dernier fonctionnement correct, ce qui a changé depuis, puis l'impact métier de la panne avant toute modification.`,
      };
    }
    return {
      reply: "Je ne vois pas d'automatisation signalée en erreur dans le contexte actuel. Dites-moi laquelle vous inquiète et ce que vous observez ; je raisonnerai à partir des faits disponibles.",
    };
  }

  if (/(outil|utilise|utilisons|connect)/.test(q)) {
    const connected = context.connections
      .filter((connection) => connection.status === "connected" || connection.status === "active")
      .map((connection) => connection.provider);
    return {
      reply: `**Ce que je connais**\n${context.tools.length ? `Outils déclarés : ${context.tools.join(", ")}.` : "Aucun outil déclaré."}\n${connected.length ? `Sources réellement connectées : ${connected.join(", ")}.` : "Je n'ai pas encore de source réellement connectée à utiliser comme preuve opérationnelle."}\n\nUn outil déclaré m'aide à comprendre votre environnement ; une source connectée me permet de raisonner sur des observations réelles.`,
    };
  }

  function describeMatch(match: AutomationTemplate): ChatReply {
    const alreadyInstalled = context.automations.find((automation) => normalize(automation.name) === normalize(match.title));
    if (alreadyInstalled) {
      return {
        reply: `Vous avez déjà une automatisation proche de ce besoin : « ${alreadyInstalled.name} ». Avant d'en ajouter une autre, je vérifierais son usage, sa fiabilité et l'impact réellement obtenu.`,
      };
    }

    const explicit = isExplicitAutomationRequest(last);
    return {
      reply: explicit
        ? `**Option concrète**\n« ${match.title} » correspond au besoin décrit : ${match.description}\n\n**Avant activation**\nLe potentiel est indicatif. Je vérifierais d'abord votre fréquence réelle, le processus actuel et la règle de validation.`
        : `**Piste à valider**\n« ${match.title} » pourrait être pertinente : ${match.description}\n\nJe ne l'installerais pas sur la seule base d'un mot-clé. Je vérifierais d'abord la fréquence et l'impact métier.`,
      ...(explicit ? { matchedTemplateId: match.id } : {}),
    };
  }

  const prevAssistant = messages[messages.length - 2];
  const prevUser = messages[messages.length - 3];
  if (prevAssistant?.role === "assistant" && prevAssistant.content.includes(CLARIFY_MARKER) && prevUser?.role === "user") {
    const combined = `${prevUser.content}. ${last}`;
    const match = findBestCatalogMatch(combined, context.tools);
    if (match) return describeMatch(match);
  }

  if (last.trim().length >= 8) {
    const match = findBestCatalogMatch(last, context.tools);
    if (match) return describeMatch(match);

    return {
      reply: `**Ce que je comprends**\nVous soulevez un sujet réel, mais je n'ai pas encore assez de faits pour trancher proprement.\n\n**Ce que je ferais maintenant**\nJe partirais du résultat attendu et du processus concerné, puis je vérifierais le volume avant de recommander une automatisation.\n\n**Une seule précision utile**\n${bestDiscoveryQuestion(context, messages)}`,
    };
  }

  return {
    reply: "Je prends votre réponse comme la suite de la conversation, pas comme une nouvelle demande. Donnez-moi juste le point que vous voulez améliorer et je vous répondrai d'abord concrètement avant de demander un détail.",
  };
}
