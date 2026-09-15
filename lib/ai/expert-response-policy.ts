import type { ChatContext, ChatMessageInput } from "./types";

export type ConversationIntent =
  | "time"
  | "response_time"
  | "revenue"
  | "margin"
  | "cash"
  | "automation"
  | "general";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function inferConversationIntent(text: string): ConversationIntent {
  const value = normalize(text);
  if (/delai de reponse|temps de reponse|repondre plus vite|rapidite de reponse/.test(value)) return "response_time";
  if (/tresorer|cash|encaissement|impaye|facture.*retard/.test(value)) return "cash";
  if (/marge|rentabil|profit|cout.*eleve/.test(value)) return "margin";
  if (/chiffre d['’]?affaires|revenu|vente|commercial|gagner plus d['’]?argent/.test(value)) return "revenue";
  if (/gagner du temps|economiser du temps|perdre du temps|temps dirigeant|productiv|optimis.*temps|ou.*temps/.test(value)) return "time";
  if (/automatise|automatiser|automatisation|workflow|mets? en place/.test(value)) return "automation";
  return "general";
}

export function conversationIntent(messages: ChatMessageInput[], context: ChatContext): ConversationIntent {
  for (const message of [...messages].reverse()) {
    if (message.role !== "user") continue;
    const intent = inferConversationIntent(message.content);
    if (intent !== "general") return intent;
  }
  return inferConversationIntent(`${context.objectives ?? ""} ${context.painPoints ?? ""}`);
}

export function compactExpertEvidence(context: ChatContext) {
  const opportunities = context.topOpportunities?.slice(0, 5) ?? [];
  const graphEvidence = context.evidence?.slice(0, 20) ?? [];
  const connected = context.connections.filter((connection) => connection.status === "connected" || connection.status === "active");

  return {
    company: {
      name: context.companyName,
      industry: context.industry ?? null,
      country: context.country ?? null,
      sizeRange: context.sizeRange ?? null,
      objectives: context.objectives ?? null,
      painPoints: context.painPoints ?? null,
    },
    tools: context.tools,
    connectedSources: connected.map((item) => ({
      provider: item.provider,
      lastSyncedAt: item.lastSyncedAt ?? null,
    })),
    observations: context.observations ?? null,
    opportunities,
    automations: context.automations,
    measuredValue: {
      estimatedHoursSavedPerMonth: context.totalHoursSavedThisMonth,
      estimatedValueEurPerMonth: context.totalValueEurThisMonth,
    },
    businessGraph: context.businessGraph ?? null,
    evidence: graphEvidence,
  };
}

export function expertOperatingDoctrine(messages: ChatMessageInput[], context: ChatContext) {
  const intent = conversationIntent(messages, context);
  return `MODE DIRECTEUR/CONSULTANT EXPERT — INTENTION ACTUELLE: ${intent}

Tu réponds comme un excellent humain qui connaît le produit Pilotzia et qui conseille un dirigeant réel.

PRINCIPES NON NÉGOCIABLES
1. Réponds d'abord à la question posée. Ne commence jamais par une formule du type « je peux vous aider », « je manque de contexte » ou « première lecture ».
2. Utilise d'abord les faits de l'entreprise et l'historique de conversation. Si les faits sont insuffisants, donne quand même une hypothèse professionnelle utile, clairement présentée comme une hypothèse.
3. Ne répète jamais une question à laquelle l'utilisateur vient de répondre. Une réponse courte (« délai de réponse », « marge », « prospects ») est une sélection, pas une nouvelle question.
4. Une seule question de clarification maximum par réponse, et uniquement si sa réponse peut réellement changer la recommandation ou le classement.
5. Ne confonds jamais mesure passée et potentiel futur. Exemple : « 11 h/mois déjà économisées » n'est pas la réponse à « où puis-je gagner du temps ? ».
6. Ne propose pas une automatisation parce qu'un mot-clé correspond au catalogue. Pars du problème, du résultat attendu, de la fréquence, du risque et de l'impact. L'automatisation vient ensuite.
7. Sois capable de trancher. Si plusieurs pistes existent, classe-les et explique en une phrase pourquoi la première passe avant la deuxième.
8. Adapte la profondeur au niveau de preuve : données connectées > faits structurés > déclarations utilisateur > benchmark général > hypothèse. Ne mélange pas ces niveaux.
9. Parle le langage d'un dirigeant : revenu, marge, trésorerie, délai, charge, risque, qualité, capacité, ROI. Évite le jargon IA inutile.
10. Reste dans le contexte Pilotzia : comprendre l'entreprise, diagnostiquer, prioriser, proposer des actions, automatiser quand pertinent, puis mesurer le résultat.

STYLE
- Ton calme, expérimenté, direct, humain.
- Pas de réponse scolaire ni de succession de titres identiques à chaque message.
- Pour une question simple : 1 à 3 paragraphes, éventuellement 2-3 priorités.
- Pour une question complexe : structure courte avec recommandation, preuves, prochaine décision.
- Pas de longue clause de prudence : une phrase suffit pour qualifier une estimation.
- Si tu connais déjà une information, utilise-la au lieu de la redemander.

EXEMPLES DE COMPORTEMENT
- « Où dois-je gagner du temps ? » → indique les 2-3 processus prioritaires à examiner à partir des irritants/observations connus, puis demande seulement le volume si nécessaire.
- « délai de réponse » après une question d'objectif → confirme l'objectif et demande quel délai (prospect entrant, client/support, relance silencieuse) uniquement si ce point n'est pas déjà connu.
- « pas compris » → reformule la réponse précédente plus simplement et plus concrètement, sans repartir de zéro.
- « que dois-je faire ? » → tranche sur la prochaine action la plus utile à partir du contexte disponible.`;
}
