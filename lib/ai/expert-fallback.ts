import { AUTOMATION_CATALOG } from "@/lib/automations/catalog";
import { findConfidentTemplateMatch, isCorrectionRequest, isExplicitAutomationRequest } from "./advisor-policy";
import { inferConversationIntent, type ConversationIntent } from "./expert-response-policy";
import type { ChatContext, ChatMessageInput, ChatReply } from "./types";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isAcknowledgement(text: string) {
  return /^(ok|okay|d'accord|dac|oui|compris|vas-y|go|parfait|tres bien|tr[eè]s bien)[.!\s]*$/i.test(text.trim());
}

function previousUser(messages: ChatMessageInput[]) {
  return [...messages.slice(0, -1)].reverse().find(
    (message) => message.role === "user" && !isAcknowledgement(message.content) && !isCorrectionRequest(message.content)
  )?.content ?? "";
}

function previousAssistant(messages: ChatMessageInput[]) {
  return [...messages.slice(0, -1)].reverse().find((message) => message.role === "assistant")?.content ?? "";
}

function selectedScope(text: string) {
  const value = normalize(text);
  if (/prospect|lead|commercial/.test(value)) return "prospects";
  if (/client|support|sav/.test(value)) return "clients";
  if (/relance|silenc|sans reponse/.test(value)) return "relances";
  return null;
}

function companyEvidenceLabel(context: ChatContext) {
  const connected = context.connections.filter((connection) => connection.status === "connected" || connection.status === "active");
  if ((context.evidence?.length ?? 0) > 0 && connected.length > 0) return "vos données connectées et votre contexte entreprise";
  if ((context.evidence?.length ?? 0) > 0) return "les faits déjà structurés dans votre Business Graph";
  if (context.painPoints || context.objectives) return "les éléments que vous avez déjà déclarés";
  return "les bonnes pratiques opérationnelles générales";
}

function rankedTimePriorities(context: ChatContext) {
  const pain = normalize(context.painPoints ?? "");
  const priorities: Array<{ title: string; why: string; score: number }> = [];

  if (/compte.?rendu|reunion|appel|meeting/.test(pain)) {
    priorities.push({
      title: "Comptes-rendus et suivi après réunion",
      why: "répétitif, structuré et peu risqué : c'est souvent le temps le plus simple à récupérer rapidement",
      score: 92,
    });
  }
  if (/prospect|relanc|lead|commercial/.test(pain)) {
    priorities.push({
      title: "Relances prospects",
      why: "vous récupérez du temps tout en réduisant le risque d'opportunités oubliées",
      score: 90,
    });
  }
  if (/factur|impay|paiement|tresorer/.test(pain)) {
    priorities.push({
      title: "Relances de factures",
      why: "le gain de temps administratif s'ajoute à un enjeu de trésorerie",
      score: 88,
    });
  }

  for (const opportunity of context.topOpportunities ?? []) {
    if (priorities.some((item) => normalize(item.title) === normalize(opportunity.title))) continue;
    priorities.push({
      title: opportunity.title,
      why: `Pilotzia la classe déjà comme une opportunité ${opportunity.impactLevel}; l'estimation catalogue est d'environ ${opportunity.estimatedHoursPerMonth} h/mois`,
      score: opportunity.impactLevel === "high" ? 75 : opportunity.impactLevel === "medium" ? 65 : 55,
    });
  }

  if (priorities.length === 0) {
    priorities.push(
      { title: "Administration récurrente", why: "reporting, saisies, comptes-rendus et transferts d'information sont souvent les premiers gisements", score: 60 },
      { title: "Suivi commercial", why: "relances et rappels manuels créent à la fois charge et perte de revenu", score: 58 },
      { title: "Suivi financier", why: "facturation, relances et rapprochements sont répétitifs et mesurables", score: 55 }
    );
  }

  return priorities.sort((a, b) => b.score - a.score).slice(0, 3);
}

function timeAnswer(context: ChatContext) {
  const priorities = rankedTimePriorities(context);
  const lines = priorities.map((item, index) => `${index + 1}. **${item.title}** — ${item.why}.`).join("\n");
  const basis = companyEvidenceLabel(context);
  const existing = context.totalHoursSavedThisMonth > 0
    ? ` Les ${context.totalHoursSavedThisMonth} h/mois déjà estimées concernent les automatisations actives : je ne les confonds pas avec le potentiel restant.`
    : "";

  return `Je regarderais d'abord ces trois zones, dans cet ordre :\n\n${lines}\n\nCe classement s'appuie sur ${basis}.${existing}\n\nPour passer d'une bonne hypothèse à une recommandation chiffrée : laquelle de ces tâches vous prend aujourd'hui le plus d'heures par semaine ?`;
}

function responseTimeAnswer(context: ChatContext, messages: ChatMessageInput[], explicitScope?: string | null) {
  const scope = explicitScope ?? selectedScope(messages[messages.length - 1]?.content ?? "");
  const pain = normalize(context.painPoints ?? "");

  if (scope === "prospects" || (!scope && /prospect|lead|commercial/.test(pain))) {
    return "Je traiterais en priorité le **temps de première réponse aux prospects entrants**. C'est généralement le délai le plus directement lié au revenu : plus il s'allonge, plus le prospect refroidit. Pilotzia doit mesurer le délai actuel, identifier où se crée l'attente, puis décider s'il faut alerter, préparer une réponse ou automatiser une partie du traitement.\n\nQuel est votre délai moyen aujourd'hui entre l'arrivée d'un prospect et la première vraie réponse ?";
  }

  if (scope === "clients") {
    return "Pour les **clients**, je regarderais d'abord le délai de première réponse puis le délai de résolution. Ce ne sont pas les mêmes problèmes : le premier relève souvent du triage et de la disponibilité, le second du processus interne.\n\nSur quel canal l'attente se crée surtout aujourd'hui : email, téléphone, chat ou autre ?";
  }

  if (scope === "relances") {
    return "Pour les **relances**, le bon indicateur n'est pas seulement la vitesse de réponse : c'est le nombre de prospects qui restent sans suivi au-delà du délai que vous jugez acceptable. Pilotzia peut ensuite prioriser les relances et préparer le bon message au bon moment.\n\nAprès combien de jours sans réponse considérez-vous qu'une relance doit partir ?";
  }

  return "Je retiens l'objectif **réduire le délai de réponse**. Pour le traiter sérieusement, il faut distinguer trois délais : première réponse à un prospect entrant, première réponse à un client, et délai avant relance d'un prospect silencieux.\n\nLequel vous coûte le plus aujourd'hui ?";
}

function revenueAnswer(context: ChatContext) {
  const pain = normalize(context.painPoints ?? "");
  if (/prospect|relanc|lead|commercial/.test(pain)) {
    return "Pour augmenter le chiffre d'affaires avec votre contexte actuel, je commencerais par **sécuriser le suivi commercial avant d'ajouter du volume** : réponse rapide aux nouveaux leads, relances systématiques, puis suivi des devis. C'est souvent plus rentable que générer davantage de prospects si une partie des opportunités existantes se perd déjà dans le suivi.\n\nÀ quelle étape avez-vous le plus de pertes aujourd'hui : première réponse, relance, devis ou closing ?";
  }
  return "Je commencerais par chercher les **fuites du parcours commercial** avant d'automatiser quoi que ce soit : où un prospect qualifié cesse-t-il d'avancer, combien de temps il y reste, et quelle valeur se perd à cet endroit. Ensuite seulement, Pilotzia doit recommander l'automatisation qui corrige cette fuite.\n\nÀ quelle étape perdez-vous le plus d'opportunités aujourd'hui ?";
}

function marginAnswer(context: ChatContext) {
  const financial = (context.evidence ?? []).filter((fact) => /margin|marge|cost|cout|expense|charge|payroll|salary/i.test(fact.predicate));
  if (financial.length > 0) {
    return "Pour la marge, je ne chercherais pas d'abord « quoi automatiser », mais **quel coût progresse plus vite que la valeur produite**. Votre Business Graph contient déjà des signaux financiers ; Pilotzia doit les rapprocher des processus opérationnels pour séparer un problème de prix, de productivité, de mix ou de charge.\n\nLe prochain bon arbitrage est d'identifier la ligne de coût qui s'est le plus dégradée sur la dernière période.";
  }
  return "Pour améliorer la marge, je regarderais dans cet ordre : **prix/mix**, **temps humain consommé par unité de valeur**, puis **coûts récurrents évitables**. L'automatisation n'est qu'un levier parmi ces trois ; elle devient prioritaire quand une tâche répétitive consomme beaucoup de temps sans augmenter la qualité.\n\nQuel poste ou processus vous semble aujourd'hui coûter trop cher par rapport à ce qu'il produit ?";
}

function cashAnswer(context: ChatContext) {
  const pain = normalize(context.painPoints ?? "");
  if (/factur|impay|paiement/.test(pain)) {
    return "Votre premier levier de trésorerie est probablement **le délai d'encaissement**, puisque les relances de factures font déjà partie de vos irritants. Je mesurerais d'abord les créances échues, leur ancienneté et le temps passé à relancer ; ensuite Pilotzia peut prioriser et automatiser les relances sans perdre le contrôle des cas sensibles.\n\nQuel est environ le montant ou le nombre de factures aujourd'hui en retard ?";
  }
  return "Pour la trésorerie, je chercherais d'abord **où le cash se bloque** : factures émises trop tard, retards clients, stock, ou décaissements mal synchronisés. Une fois le goulot identifié, Pilotzia peut proposer l'action et l'automatisation adaptées.\n\nQuel est votre principal point de tension aujourd'hui ?";
}

function measurementAnswer(context: ChatContext) {
  if (context.totalHoursSavedThisMonth <= 0) {
    return "Je n'ai pas encore de gain réellement suivi sur les automatisations actives. Je préfère vous le dire plutôt que fabriquer un ROI. Dès qu'une automatisation tourne, Pilotzia doit mesurer usage, temps évité et indicateur métier avant/après.";
  }
  return `Sur les automatisations actives, Pilotzia estime actuellement **${context.totalHoursSavedThisMonth} h/mois**, soit environ **${context.totalValueEurThisMonth} € de temps valorisé**. Ce n'est pas encore un ROI complet : pour le calculer sérieusement, il faut intégrer le coût réel et un indicateur métier avant/après.`;
}

function generalExpertAnswer(context: ChatContext) {
  const opportunities = context.topOpportunities?.slice(0, 3) ?? [];
  if (opportunities.length > 0) {
    const ranked = opportunities
      .map((opportunity, index) => `${index + 1}. **${opportunity.title}** — impact ${opportunity.impactLevel}, ~${opportunity.estimatedHoursPerMonth} h/mois estimées.`)
      .join("\n");
    return `Avec ce que Pilotzia connaît déjà de votre entreprise, je ne repartirais pas de zéro. Les priorités actuellement les mieux classées sont :\n\n${ranked}\n\nJe les traiterais comme des hypothèses à valider par vos volumes réels, puis je choisirais celle qui combine le plus d'impact économique et le moins de friction de mise en œuvre.`;
  }

  if (context.painPoints) {
    return `Vous avez déjà donné un signal utile : **${context.painPoints}**. Je partirais de là plutôt que d'un catalogue générique. La prochaine étape est de mesurer fréquence, temps consommé et impact business sur ce processus ; c'est ce qui permettra à Pilotzia de dire s'il faut simplifier, automatiser ou changer le processus.`;
  }

  return "Je vais raisonner comme un consultant qui découvre l'entreprise : d'abord le résultat à améliorer, ensuite le processus qui le bloque, puis seulement la solution. Si vous me donnez votre priorité actuelle — revenu, marge, trésorerie, temps ou délai de réponse — je peux déjà vous proposer un premier arbitrage utile sans vous faire remplir un questionnaire.";
}

function answerForIntent(intent: ConversationIntent, context: ChatContext, messages: ChatMessageInput[], scope?: string | null) {
  if (intent === "time") return timeAnswer(context);
  if (intent === "response_time") return responseTimeAnswer(context, messages, scope);
  if (intent === "revenue") return revenueAnswer(context);
  if (intent === "margin") return marginAnswer(context);
  if (intent === "cash") return cashAnswer(context);
  return generalExpertAnswer(context);
}

export function runExpertFallbackChat(messages: ChatMessageInput[], context: ChatContext): ChatReply {
  const last = messages[messages.length - 1]?.content ?? "";
  const normalized = normalize(last);
  const prevAssistant = previousAssistant(messages);

  if (/combien.*(heure|temps|euro)|temps economis|heures economis|valeur estime|gain actuel|roi|retour sur investissement/.test(normalized)) {
    return { reply: measurementAnswer(context) };
  }

  if (isCorrectionRequest(last) || /pas compris|je ne comprends|reformule|plus simple/.test(normalized)) {
    const original = previousUser(messages);
    const intent = inferConversationIntent(original);
    return { reply: answerForIntent(intent, context, messages, selectedScope(original)) };
  }

  if (isAcknowledgement(last)) {
    const original = previousUser(messages);
    const intent = inferConversationIntent(original);
    return { reply: answerForIntent(intent, context, messages, selectedScope(original)) };
  }

  const scope = selectedScope(last);
  if (last.trim().length <= 80 && prevAssistant.includes("?") && scope) {
    const previousIntent = inferConversationIntent(previousUser(messages));
    const intent = previousIntent === "general" && /delai|réponse|reponse/.test(normalize(prevAssistant)) ? "response_time" : previousIntent;
    return { reply: answerForIntent(intent, context, messages, scope) };
  }

  const intent = inferConversationIntent(last);

  if (isExplicitAutomationRequest(last)) {
    const match = findConfidentTemplateMatch(last, AUTOMATION_CATALOG, context.tools);
    if (match) {
      const alreadyInstalled = context.automations.some((automation) => normalize(automation.name) === normalize(match.title));
      if (alreadyInstalled) {
        return { reply: `Vous avez déjà une automatisation proche : **${match.title}**. Avant d'en créer une autre, je vérifierais son usage, sa fiabilité et le résultat obtenu ; doubler un workflow qui fonctionne mal ne ferait qu'ajouter de la complexité.` };
      }
      return {
        reply: `Oui, **${match.title}** correspond au processus que vous voulez automatiser. Je la traiterais comme une recommandation à valider, avec une estimation catalogue d'environ ${match.estimatedHoursPerMonth} h/mois, puis je vérifierais votre volume réel avant activation.`,
        matchedTemplateId: match.id,
      };
    }
  }

  return { reply: answerForIntent(intent, context, messages, scope) };
}
