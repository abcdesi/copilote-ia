import type { ChatContext, ChatMessageInput } from "./types";

export type ConversationIntent =
  | "time"
  | "response_time"
  | "revenue"
  | "margin"
  | "cash"
  | "hr"
  | "marketing"
  | "accounting"
  | "operations"
  | "automation"
  | "general";

type BusinessDomain = "finance" | "accounting" | "sales" | "marketing" | "hr" | "operations";

const DOMAIN_KEYWORDS: Record<BusinessDomain, string[]> = {
  finance: ["finance", "marge", "rentabil", "tresorer", "cash", "cout", "charge", "ebit", "dette", "creance", "budget"],
  accounting: ["compta", "factur", "impaye", "rapproch", "cloture", "journal", "recouvrement"],
  sales: ["commercial", "vente", "ca", "prospect", "lead", "pipeline", "devis", "crm", "conversion", "relance"],
  marketing: ["marketing", "acquisition", "campagne", "seo", "ads", "publicite", "contenu", "audience", "cpl", "cac"],
  hr: ["rh", "recrut", "salar", "equipe", "onboarding", "charge", "absence", "talent", "manager"],
  operations: ["operation", "process", "workflow", "production", "support", "delai", "reunion", "qualite", "blocage", "temps"],
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function textMatches(text: string, keyword: string) {
  const haystack = normalize(text);
  const needle = normalize(keyword);
  if (!haystack || !needle) return false;
  const tokens = haystack.split(/\s+/).filter(Boolean);
  if (needle.includes(" ")) return ` ${haystack} `.includes(` ${needle} `);
  if (needle.length <= 3) return tokens.includes(needle);
  return tokens.some((token) => token === needle || token.startsWith(needle));
}

export function inferConversationIntent(text: string): ConversationIntent {
  const value = normalize(text);
  if (/delai de reponse|temps de reponse|repondre plus vite|rapidite de reponse/.test(value)) return "response_time";
  if (/tresorer|cash|encaissement|impaye|facture.*retard/.test(value)) return "cash";
  if (/marge|rentabil|profit|cout.*eleve/.test(value)) return "margin";
  if (/recrut|onboarding|salar|rh|ressource humaine|absenteisme/.test(value)) return "hr";
  if (/marketing|acquisition|campagne|seo|publicite|ads|contenu/.test(value)) return "marketing";
  if (/compta|comptabil|rapproch|cloture|facturation/.test(value)) return "accounting";
  if (/production|operation|workflow|process|support|qualite|blocage/.test(value)) return "operations";
  if (/chiffre d['’]?affaires|revenu|vente|commercial|prospect|pipeline|gagner plus d['’]?argent/.test(value)) return "revenue";
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

function currentUserText(messages: ChatMessageInput[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function intentDomainBoost(intent: ConversationIntent): BusinessDomain[] {
  if (intent === "cash" || intent === "margin") return ["finance", "accounting"];
  if (intent === "revenue" || intent === "response_time") return ["sales", "marketing", "operations"];
  if (intent === "hr") return ["hr", "operations"];
  if (intent === "marketing") return ["marketing", "sales"];
  if (intent === "accounting") return ["accounting", "finance"];
  if (intent === "operations" || intent === "time") return ["operations", "sales", "accounting", "hr"];
  return [];
}

export function inferRelevantDomains(messages: ChatMessageInput[], context: ChatContext): BusinessDomain[] {
  const lastUser = currentUserText(messages);
  const activeSituation = `${context.objectives ?? ""} ${context.painPoints ?? ""}`;
  const intent = conversationIntent(messages, context);
  const boosted = new Set(intentDomainBoost(intent));

  const ranked = (Object.keys(DOMAIN_KEYWORDS) as BusinessDomain[])
    .map((domain) => {
      const keywords = DOMAIN_KEYWORDS[domain];
      const directMatches = keywords.filter((keyword) => textMatches(lastUser, keyword)).length;
      const situationMatches = keywords.filter((keyword) => textMatches(activeSituation, keyword)).length;
      const coverage = context.knowledgeCoverage?.sections.find((section) => section.key === domain)?.score ?? 0;
      const score = directMatches * 8 + situationMatches * 2 + (boosted.has(domain) ? 6 : 0) + Math.min(2, coverage / 50);
      return { domain, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length) return ranked.slice(0, 3).map((item) => item.domain);

  return (Object.keys(context.domainContexts ?? {}) as BusinessDomain[])
    .filter((domain) => Boolean(context.domainContexts?.[domain]))
    .slice(0, 2);
}

function evidenceRelevanceScore(
  evidence: NonNullable<ChatContext["evidence"]>[number],
  lastUser: string,
  selectedDomains: BusinessDomain[]
) {
  const text = `${evidence.subject} ${evidence.predicate} ${JSON.stringify(evidence.value)}`;
  const direct = normalize(lastUser)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && textMatches(text, token)).length;
  const domainMatches = selectedDomains.reduce(
    (sum, domain) => sum + DOMAIN_KEYWORDS[domain].filter((keyword) => textMatches(text, keyword)).length,
    0
  );
  const ageDays = Math.max(0, (Date.now() - new Date(evidence.observedAt).getTime()) / 86_400_000);
  const freshness = ageDays <= 30 ? 4 : ageDays <= 90 ? 2 : ageDays <= 180 ? 1 : 0;
  return direct * 5 + domainMatches * 2 + freshness + Math.max(0, evidence.confidence) * 3;
}

export function compactExpertEvidence(messages: ChatMessageInput[], context: ChatContext) {
  const opportunities = context.topOpportunities?.slice(0, 5) ?? [];
  const connected = context.connections.filter((connection) => connection.status === "connected" || connection.status === "active");
  const selectedDomains = inferRelevantDomains(messages, context);
  const lastUser = currentUserText(messages);
  const selectedDomainContexts = Object.fromEntries(
    selectedDomains
      .map((domain) => [domain, context.domainContexts?.[domain] ?? null] as const)
      .filter(([, value]) => Boolean(value))
  );
  const relevantSections = (context.knowledgeCoverage?.sections ?? [])
    .filter((section) => selectedDomains.includes(section.key as BusinessDomain))
    .map((section) => ({
      key: section.key,
      label: section.label,
      score: section.score,
      freshness: section.freshness ?? null,
      lastUpdatedAt: section.lastUpdatedAt ?? null,
      missingOrStale: section.dimensions
        ?.filter((dimension) => dimension.status === "missing" || dimension.status === "stale")
        .slice(0, 4)
        .map((dimension) => ({ label: dimension.label, status: dimension.status, question: dimension.question })) ?? [],
    }));
  const graphEvidence = [...(context.evidence ?? [])]
    .sort((a, b) => evidenceRelevanceScore(b, lastUser, selectedDomains) - evidenceRelevanceScore(a, lastUser, selectedDomains))
    .slice(0, 14);

  return {
    currentSituation: {
      currentQuestion: lastUser || null,
      activeObjectives: context.objectives ?? null,
      activePainPoints: context.painPoints ?? null,
      selectedDomains,
      relevantKnowledge: relevantSections,
    },
    company: {
      name: context.companyName,
      industry: context.industry ?? null,
      country: context.country ?? null,
      sizeRange: context.sizeRange ?? null,
      businessModel: context.businessModel ?? null,
      customerProfile: context.customerProfile ?? null,
      localContext: context.localContext ?? null,
    },
    domainContexts: selectedDomainContexts,
    knowledgeCoverage: context.knowledgeCoverage
      ? { overall: context.knowledgeCoverage.overall, level: context.knowledgeCoverage.level }
      : null,
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
  const selectedDomains = inferRelevantDomains(messages, context);
  const relevantMissing = (context.knowledgeCoverage?.sections ?? [])
    .filter((section) => selectedDomains.includes(section.key as BusinessDomain))
    .flatMap((section) =>
      (section.dimensions ?? [])
        .filter((dimension) => dimension.status === "missing" || dimension.status === "stale")
        .map((dimension) => ({ section: section.label, ...dimension }))
    )[0];

  return `MODE DIRECTEUR/CONSULTANT EXPERT — INTENTION ACTUELLE: ${intent}
DOMAINES À MOBILISER EN PRIORITÉ: ${selectedDomains.join(", ") || "contexte général"}

Tu réponds comme un excellent humain qui connaît le produit Pilotzia et qui conseille un dirigeant réel.

PRINCIPES NON NÉGOCIABLES
1. Réponds d'abord à la question posée. Ne commence jamais par une formule du type « je peux vous aider », « je manque de contexte » ou « première lecture ».
2. Mobilise seulement les informations utiles au sujet précis : contexte actuel, domaines concernés, faits les plus récents, connexions et historique immédiat. Ne noie pas la décision sous tout le dossier entreprise.
3. Les attentes du dirigeant, les problèmes, l'équipe, les chiffres et les priorités évoluent. Une information récente et directe prime sur une ancienne déclaration. Si une donnée pertinente est marquée stale/à actualiser, ne la traite pas comme une vérité actuelle sans le signaler.
4. Utilise d'abord les faits de l'entreprise et l'historique de conversation. Si les faits sont insuffisants, donne quand même une hypothèse professionnelle utile, clairement présentée comme une hypothèse.
5. Ne répète jamais une question à laquelle l'utilisateur vient de répondre. Une réponse courte (« délai de réponse », « marge », « prospects ») est une sélection, pas une nouvelle question.
6. Une seule question de clarification maximum par réponse. Choisis la question qui réduit le plus l'incertitude sur la décision actuelle, pas la rubrique globalement la moins remplie.${relevantMissing ? ` Question manquante actuellement utile : ${relevantMissing.section} — ${relevantMissing.question}` : ""}
7. Ne confonds jamais mesure passée et potentiel futur. Exemple : « 11 h/mois déjà économisées » n'est pas la réponse à « où puis-je gagner du temps ? ».
8. Ne propose pas une automatisation parce qu'un mot-clé correspond au catalogue. Pars du problème, du résultat attendu, de la fréquence, du risque et de l'impact. L'automatisation vient ensuite.
9. Sois capable de trancher. Si plusieurs pistes existent, classe-les et explique en une phrase pourquoi la première passe avant la deuxième.
10. Adapte la profondeur au niveau de preuve : données connectées fraîches > faits structurés récents > déclarations utilisateur actuelles > estimations Pilotzia > bonnes pratiques générales > hypothèses.
11. Parle le langage d'un dirigeant : revenu, marge, trésorerie, délai, charge, risque, qualité, capacité, ROI. Évite le jargon IA inutile.
12. Reste dans le contexte Pilotzia : comprendre la situation actuelle, diagnostiquer, prioriser, proposer des actions, automatiser quand pertinent, puis mesurer le résultat et réviser la compréhension de l'entreprise.

STYLE
- Ton calme, expérimenté, direct, humain.
- Pas de réponse scolaire ni de succession de titres identiques à chaque message.
- Pour une question simple : 1 à 3 paragraphes, éventuellement 2-3 priorités.
- Pour une question complexe : structure courte avec recommandation, preuves, prochaine décision.
- Pas de longue clause de prudence : une phrase suffit pour qualifier une estimation.
- Si tu connais déjà une information, utilise-la au lieu de la redemander.

EXEMPLES DE COMPORTEMENT
- « Où dois-je gagner du temps ? » → mobilise surtout les processus et irritants actuels, puis demande uniquement le volume qui peut changer le classement.
- « délai de réponse » après une question d'objectif → confirme l'objectif et distingue prospect entrant, client/support ou relance seulement si le contexte ne permet pas déjà de trancher.
- « recrutement » → mobilise RH + charge opérationnelle + objectifs actuels ; ne charge pas inutilement la finance si elle n'aide pas la décision.
- « pas compris » → reformule la réponse précédente plus simplement et plus concrètement, sans repartir de zéro.
- « que dois-je faire ? » → tranche sur la prochaine action la plus utile à partir de la situation actuelle et des preuves pertinentes.`;
}
